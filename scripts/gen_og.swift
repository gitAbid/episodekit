// Render the SermonKit OG image (1200x630 PNG) with CoreGraphics — no deps.
// Usage: swift scripts/gen_og.swift site/og.png
import Foundation
import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers

let out = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "site/og.png"
let W = 1200, H = 630
let cs = CGColorSpace(name: CGColorSpace.sRGB)!
let ctx = CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0,
                    space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!

// deep space background
ctx.setFillColor(CGColor(red: 0.055, green: 0.067, blue: 0.086, alpha: 1))
ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
// radial-ish accent glows (concentric translucent circles)
for (cx, cy, r, col) in [
  (CGFloat(230), CGFloat(560), CGFloat(480), CGColor(red: 0.91, green: 0.69, blue: 0.29, alpha: 0.10)),
  (CGFloat(1020), CGFloat(120), CGFloat(520), CGColor(red: 0.44, green: 0.70, blue: 1.0, alpha: 0.08)),
] {
  for i in stride(from: CGFloat(1), through: 12, by: 1) {
    ctx.setFillColor(col)
    ctx.fillEllipse(in: CGRect(x: cx - r / i, y: cy - r / i, width: 2 * r / i, height: 2 * r / i))
  }
}

func draw(_ text: String, font: CTFont, color: CGColor, x: CGFloat, y: CGFloat) {
  let attr = NSAttributedString(string: text, attributes: [
    NSAttributedString.Key(kCTFontAttributeName as String): font,
    NSAttributedString.Key(kCTForegroundColorAttributeName as String): color,
  ])
  let line = CTLineCreateWithAttributedString(attr)
  ctx.textPosition = CGPoint(x: x, y: y)
  CTLineDraw(line, ctx)
}

let system = CTFontCreateWithName("HelveticaNeue-Bold" as CFString, 96, nil)
let systemMed = CTFontCreateWithName("HelveticaNeue-Medium" as CFString, 40, nil)
let gold = CGColor(red: 0.91, green: 0.69, blue: 0.29, alpha: 1)
let white = CGColor(red: 0.91, green: 0.93, blue: 0.96, alpha: 1)
let muted = CGColor(red: 0.60, green: 0.65, blue: 0.72, alpha: 1)

draw("Episode", font: system, color: white, x: 90, y: 430)
// measure "Sermon" to place "Kit" after it
let sermonLine = CTLineCreateWithAttributedString(NSAttributedString(string: "Episode", attributes: [NSAttributedString.Key(kCTFontAttributeName as String): system]))
let sermonW = CGFloat(CTLineGetTypographicBounds(sermonLine, nil, nil, nil))
draw("Kit", font: system, color: gold, x: 90 + sermonW + 8, y: 430)
draw("One episode. A month of content.", font: systemMed, color: white, x: 92, y: 330)
draw("Article · Discussion kit · Email series · Social pack", font: systemMed, color: muted, x: 92, y: 250)
draw("episodekit.app", font: systemMed, color: gold, x: 92, y: 110)

// thin gold rule
ctx.setFillColor(gold)
ctx.fill(CGRect(x: 92, y: 190, width: 120, height: 5))

let img = ctx.makeImage()!
let png = NSMutableData()
let dest = CGImageDestinationCreateWithData(png, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, img, nil)
CGImageDestinationFinalize(dest)
try! (png as Data).write(to: URL(fileURLWithPath: out))
print("wrote \(out) (\(png.count) bytes)")
