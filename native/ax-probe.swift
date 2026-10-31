// ax-probe — 커서 근처 버튼·입력칸·글씨(label·span)·아이콘(svg)의 종류·라벨·위치를 읽는 읽기 전용 도우미 (PRD OQ-8).
// Spooky main 프로세스가 띄우고, stdin 한 줄 명령 → stdout 한 줄 JSON으로 대화한다.
//   trust        → {"trusted":bool}
//   prompt       → 손쉬운 사용 권한 요청 창을 띄우고 {"trusted":bool}
//   probe X Y    → {"trusted":bool,"hit":null|{kind,role,label,app,frame:{x,y,width,height}},"miss":…}
// 외부 앱의 요소를 누르거나 값을 바꾸는 API는 쓰지 않는다. 입력칸은 입력된 값을 읽지 않고, 비밀번호 칸은 건너뛴다.

import ApplicationServices
import Cocoa

setvbuf(stdout, nil, _IOLBF, 0)

let ownPid = getppid() // Spooky 자신의 창(오버레이·데모)은 건너뛴다
let buttonRoles: Set<String> = [
  "AXButton", "AXLink", "AXMenuButton", "AXPopUpButton", "AXCheckBox", "AXRadioButton",
]
let inputRoles: Set<String> = ["AXTextField", "AXTextArea", "AXComboBox", "AXSearchField"]
// 접근성 API는 HTML 태그를 알려 주지 않는다 — label·span은 화면 글씨(AXStaticText), svg는 AXImage로 본다
let textRoles: Set<String> = ["AXStaticText"]
let iconRoles: Set<String> = ["AXImage"]
// 커서 바로 아래 → 30·60·90·120px 원을 약 30px 간격으로 살핀다 (버튼은 보통 24px 이상)
let ringRadii: [CGFloat] = [30, 60, 90, 120]
let sampleSpacing: CGFloat = 30
var accessibilityRequested = Set<pid_t>()
// Chromium 계열 브라우저는 AXEnhancedUserInterface가 있어야 웹페이지 안 요소를 연다.
// 다른 앱에 켜면 창 애니메이션이 어색해질 수 있어 브라우저에만 쓴다
let chromiumBrowsers: Set<String> = [
  "com.google.Chrome", "com.google.Chrome.canary", "com.microsoft.edgemac", "com.brave.Browser",
  "company.thebrowser.Browser", "com.vivaldi.Vivaldi", "com.operasoftware.Opera",
]

func attribute(_ element: AXUIElement, _ name: String) -> CFTypeRef? {
  var value: CFTypeRef?
  return AXUIElementCopyAttributeValue(element, name as CFString, &value) == .success ? value : nil
}

func text(_ element: AXUIElement, _ name: String) -> String? {
  guard let value = attribute(element, name) as? String else { return nil }
  let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
  return trimmed.isEmpty ? nil : trimmed
}

func frame(of element: AXUIElement) -> CGRect? {
  guard let position = attribute(element, "AXPosition"), let size = attribute(element, "AXSize")
  else { return nil }
  var origin = CGPoint.zero
  var extent = CGSize.zero
  guard AXValueGetValue(position as! AXValue, .cgPoint, &origin),
    AXValueGetValue(size as! AXValue, .cgSize, &extent)
  else { return nil }
  return CGRect(origin: origin, size: extent)
}

// 입력칸: 사용자가 입력한 값(AXValue)은 절대 읽지 않는다. 라벨·placeholder만
func inputLabel(of element: AXUIElement) -> String? {
  if let own = text(element, "AXTitle") ?? text(element, "AXDescription")
    ?? text(element, "AXPlaceholderValue")
  {
    return own
  }
  // <label for>처럼 연결된 라벨 요소
  if let titleElement = attribute(element, "AXTitleUIElement") {
    let labelElement = titleElement as! AXUIElement
    return text(labelElement, "AXValue") ?? text(labelElement, "AXTitle")
  }
  return nil
}

func label(of element: AXUIElement) -> String? {
  if let title = text(element, "AXTitle") ?? text(element, "AXDescription") ?? text(element, "AXValue") {
    return title
  }
  // 웹 버튼은 글씨가 자식 정적 텍스트에 들어 있는 경우가 많다
  guard let children = attribute(element, "AXChildren") as? [AXUIElement] else { return nil }
  for child in children.prefix(4) {
    if let value = text(child, "AXValue") ?? text(child, "AXTitle") { return value }
  }
  return nil
}

// 커서 아래에서 가장 앞에 있는 일반 창(layer 0)의 주인 앱. 창 이름은 읽지 않는다
func onScreenWindows() -> [[String: Any]] {
  CGWindowListCopyWindowInfo([.optionOnScreenOnly, .excludeDesktopElements], kCGNullWindowID)
    as? [[String: Any]] ?? []
}

func windowOwner(at point: CGPoint, in windows: [[String: Any]]) -> pid_t? {
  for window in windows {
    guard (window[kCGWindowLayer as String] as? Int) == 0,
      let pid = window[kCGWindowOwnerPID as String] as? pid_t, pid != ownPid,
      let boundsDict = window[kCGWindowBounds as String] as? NSDictionary,
      let bounds = CGRect(dictionaryRepresentation: boundsDict), bounds.contains(point)
    else { continue }
    return pid
  }
  return nil
}

var lastMiss: [String: Any] = [:] // 못 찾았을 때 진단용 — 글씨는 담지 않는다

typealias Found = (info: [String: Any], rect: CGRect)

func elementAt(_ point: CGPoint, windows: [[String: Any]]) -> Found? {
  guard let pid = windowOwner(at: point, in: windows) else {
    lastMiss = ["reason": "no window"]
    return nil
  }
  let appName = NSRunningApplication(processIdentifier: pid)?.localizedName ?? ""
  let app = AXUIElementCreateApplication(pid)
  // Electron 앱은 AXManualAccessibility, Chromium 브라우저는 AXEnhancedUserInterface로 웹 콘텐츠 트리를 연다
  if !accessibilityRequested.contains(pid) {
    AXUIElementSetAttributeValue(app, "AXManualAccessibility" as CFString, kCFBooleanTrue)
    if let bundle = NSRunningApplication(processIdentifier: pid)?.bundleIdentifier,
      chromiumBrowsers.contains(bundle)
    {
      AXUIElementSetAttributeValue(app, "AXEnhancedUserInterface" as CFString, kCFBooleanTrue)
    }
    accessibilityRequested.insert(pid)
  }

  var hit: AXUIElement?
  let status = AXUIElementCopyElementAtPosition(app, Float(point.x), Float(point.y), &hit)
  guard status == .success, var element = hit else {
    lastMiss = ["reason": "hit test \(status.rawValue)", "app": appName]
    return nil
  }

  // 버튼·입력칸을 먼저 찾고, 없으면 처음 만난 글씨·아이콘을 쓴다.
  // 글씨·아이콘이 버튼 안에 있으면 위로 올라가다 그 버튼을 고르게 된다
  var roles: [String] = []
  var fallback: Found?
  for _ in 0..<6 {
    let role = text(element, "AXRole") ?? ""
    roles.append(role.isEmpty ? "?" : role)
    if text(element, "AXSubrole") == "AXSecureTextField" {
      lastMiss = ["reason": "secure field skipped", "app": appName]
      return nil
    }
    let kind =
      buttonRoles.contains(role) ? "button"
      : inputRoles.contains(role) ? "input"
      : textRoles.contains(role) ? "text"
      : iconRoles.contains(role) ? "icon" : nil
    if let kind, let rect = frame(of: element), rect.width > 0, rect.height > 0 {
      let name: String? =
        switch kind {
        case "input": inputLabel(of: element) ?? "text field"
        case "text": text(element, "AXValue") ?? text(element, "AXTitle")
        case "icon": text(element, "AXDescription") ?? text(element, "AXTitle") ?? "icon"
        default: label(of: element)
        }
      if let name {
        let info: [String: Any] = [
          "kind": kind,
          "role": role,
          "label": String(name.prefix(120)), // 단어 경계 자르기는 Spooky(spoken-text.ts)가 한다
          "app": appName,
          "frame": ["x": rect.minX, "y": rect.minY, "width": rect.width, "height": rect.height],
        ]
        if kind == "button" || kind == "input" { return (info, rect) }
        if fallback == nil { fallback = (info, rect) }
      }
    }
    guard let parent = attribute(element, "AXParent") else { break }
    element = parent as! AXUIElement
  }
  if let fallback { return fallback }
  lastMiss = ["reason": "no target element", "app": appName, "roles": roles]
  return nil
}

// 커서에서 사각형까지의 거리 (안에 있으면 0)
func distance(from point: CGPoint, to rect: CGRect) -> CGFloat {
  let dx = max(rect.minX - point.x, 0, point.x - rect.maxX)
  let dy = max(rect.minY - point.y, 0, point.y - rect.maxY)
  return hypot(dx, dy)
}

// 반경 120px 안에서 커서에 가장 가까운 버튼·입력칸.
// 안쪽 원부터 살피고, 무언가 찾은 원에서 멈춰 그중 가장 가까운 것을 고른다 — 판단이 늦어지지 않게
func nearest(to cursor: CGPoint) -> [String: Any]? {
  let windows = onScreenWindows()
  if let center = elementAt(cursor, windows: windows) { return center.info }
  let centerMiss = lastMiss // 진단은 커서 바로 아래 결과만 남긴다

  var found: [Found] = []
  for radius in ringRadii {
    let count = max(8, Int((2 * .pi * radius / sampleSpacing).rounded()))
    for i in 0..<count {
      let angle = 2 * .pi * CGFloat(i) / CGFloat(count)
      let point = CGPoint(x: cursor.x + radius * cos(angle), y: cursor.y + radius * sin(angle))
      if found.contains(where: { $0.rect.contains(point) }) { continue }
      if let hit = elementAt(point, windows: windows) { found.append(hit) }
    }
    if let best = found.min(by: { distance(from: cursor, to: $0.rect) < distance(from: cursor, to: $1.rect) }) {
      return best.info
    }
  }
  lastMiss = centerMiss
  return nil
}

func reply(_ object: [String: Any]) {
  guard let data = try? JSONSerialization.data(withJSONObject: object),
    let line = String(data: data, encoding: .utf8)
  else { return print("{}") }
  print(line)
}

while let line = readLine() {
  let parts = line.split(separator: " ")
  switch parts.first {
  case "trust":
    reply(["trusted": AXIsProcessTrusted()])
  case "prompt":
    let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
    reply(["trusted": AXIsProcessTrustedWithOptions(options)])
  case "probe" where parts.count == 3:
    guard AXIsProcessTrusted() else {
      reply(["trusted": false])
      continue
    }
    let cursor = CGPoint(x: Double(parts[1]) ?? 0, y: Double(parts[2]) ?? 0)
    let started = Date()
    let hit = nearest(to: cursor)
    reply([
      "trusted": true,
      "hit": hit ?? NSNull(),
      "miss": hit == nil ? lastMiss : NSNull(),
      "ms": Int(Date().timeIntervalSince(started) * 1000),
    ])
  default:
    reply(["error": "unknown command"])
  }
}
