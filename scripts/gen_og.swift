// Render the EpisodeKit OG image (1200x630 PNG) with CoreGraphics — no deps.
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

// flat background (matches site/css/theme.css light tokens)
func rgb(_ hex: Int) -> CGColor {
  CGColor(red: CGFloat((hex >> 16) & 0xff) / 255, green: CGFloat((hex >> 8) & 0xff) / 255, blue: CGFloat(hex & 0xff) / 255, alpha: 1)
}
let bg = rgb(0xffffff), border = rgb(0xe3e6eb), text = rgb(0x111827), body = rgb(0x4b5563), accent = rgb(0x2457d6)
ctx.setFillColor(bg)
ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
// bottom rule
ctx.setFillColor(border)
ctx.fill(CGRect(x: 0, y: 96, width: W, height: 2))

func draw(_ text: String, font: CTFont, color: CGColor, x: CGFloat, y: CGFloat) {
  let attr = NSAttributedString(string: text, attributes: [
    NSAttributedString.Key(kCTFontAttributeName as String): font,
    NSAttributedString.Key(kCTForegroundColorAttributeName as String): color,
  ])
  let line = CTLineCreateWithAttributedString(attr)
  ctx.textPosition = CGPoint(x: x, y: y)
  CTLineDraw(line, ctx)
}

// brand mark: solid accent square with three level bars (same as the CSS mark)
let mx: CGFloat = 92, my: CGFloat = 470, ms: CGFloat = 64
ctx.setFillColor(accent)
ctx.addPath(CGPath(roundedRect: CGRect(x: mx, y: my, width: ms, height: ms), cornerWidth: 14, cornerHeight: 14, transform: nil))
ctx.fillPath()
ctx.setFillColor(bg)
for (bx, h) in [(CGFloat(15), CGFloat(18)), (CGFloat(29), CGFloat(36)), (CGFloat(43), CGFloat(12))] {
  ctx.fill(CGRect(x: mx + bx, y: my + (ms - h) / 2, width: 6, height: h))
}

let bold = CTFontCreateWithName("HelveticaNeue-Bold" as CFString, 44, nil)
let headline = CTFontCreateWithName("HelveticaNeue-Bold" as CFString, 76, nil)
let medium = CTFontCreateWithName("HelveticaNeue-Medium" as CFString, 32, nil)

draw("EpisodeKit", font: bold, color: text, x: mx + ms + 22, y: my + 17)
draw("One episode,", font: headline, color: text, x: 92, y: 340)
draw("a month of content.", font: headline, color: text, x: 92, y: 252)
draw("Show notes · Discussion kit · Email series · Social pack", font: medium, color: body, x: 92, y: 168)
draw("episodekit.vercel.app", font: medium, color: accent, x: 92, y: 42)

let img = ctx.makeImage()!
let png = NSMutableData()
let dest = CGImageDestinationCreateWithData(png, UTType.png.identifier as CFString, 1, nil)!
CGImageDestinationAddImage(dest, img, nil)
CGImageDestinationFinalize(dest)
try! (png as Data).write(to: URL(fileURLWithPath: out))
print("wrote \(out) (\(png.count) bytes)")
