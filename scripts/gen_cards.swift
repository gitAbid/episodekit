// Demo video cards — 1280x720 intro/end frames. swift scripts/gen_cards.swift out/
import Foundation
import CoreGraphics
import CoreText
import ImageIO
import UniformTypeIdentifiers

let outDir = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "out"
let W = 1280, H = 720
let cs = CGColorSpace(name: CGColorSpace.sRGB)!

func makeCtx() -> CGContext {
  CGContext(data: nil, width: W, height: H, bitsPerComponent: 8, bytesPerRow: 0,
            space: cs, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
}

func draw(_ text: String, font: CTFont, color: CGColor, x: CGFloat, y: CGFloat, ctx: CGContext) {
  let attr = NSAttributedString(string: text, attributes: [
    NSAttributedString.Key(kCTFontAttributeName as String): font,
    NSAttributedString.Key(kCTForegroundColorAttributeName as String): color,
  ])
  let line = CTLineCreateWithAttributedString(attr)
  ctx.textPosition = CGPoint(x: x, y: y)
  CTLineDraw(line, ctx)
}

func width(_ text: String, font: CTFont) -> CGFloat {
  let attr = NSAttributedString(string: text, attributes: [NSAttributedString.Key(kCTFontAttributeName as String): font])
  return CGFloat(CTLineGetTypographicBounds(CTLineCreateWithAttributedString(attr), nil, nil, nil))
}

func write(_ ctx: CGContext, _ name: String) {
  let img = ctx.makeImage()!
  let png = NSMutableData()
  let dest = CGImageDestinationCreateWithData(png, UTType.png.identifier as CFString, 1, nil)!
  CGImageDestinationAddImage(dest, img, nil)
  CGImageDestinationFinalize(dest)
  try! (png as Data).write(to: URL(fileURLWithPath: "\(outDir)/\(name)"))
  print("wrote \(outDir)/\(name)")
}

let bg = CGColor(red: 0.043, green: 0.055, blue: 0.075, alpha: 1)
let gold = CGColor(red: 0.91, green: 0.69, blue: 0.29, alpha: 1)
let white = CGColor(red: 0.91, green: 0.93, blue: 0.96, alpha: 1)
let muted = CGColor(red: 0.55, green: 0.60, blue: 0.68, alpha: 1)

// glows
func glow(_ ctx: CGContext, cx: CGFloat, cy: CGFloat, r: CGFloat, c: CGColor) {
  for i in stride(from: CGFloat(1), through: 10, by: 1) {
    ctx.setFillColor(c)
    ctx.fillEllipse(in: CGRect(x: cx - r / i, y: cy - r / i, width: 2 * r / i, height: 2 * r / i))
  }
}

let bold = CTFontCreateWithName("HelveticaNeue-Bold" as CFString, 96, nil)
let med = CTFontCreateWithName("HelveticaNeue-Medium" as CFString, 40, nil)
let medBig = CTFontCreateWithName("HelveticaNeue-Medium" as CFString, 52, nil)

// INTRO card
do {
  let ctx = makeCtx()
  ctx.setFillColor(bg); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
  glow(ctx, cx: 240, cy: 620, r: 500, c: CGColor(red: 0.91, green: 0.69, blue: 0.29, alpha: 0.10))
  glow(ctx, cx: 1060, cy: 120, r: 460, c: CGColor(red: 0.44, green: 0.70, blue: 1.0, alpha: 0.08))
  let t1 = "Episode", t2 = "Kit"
  let w1 = width(t1, font: bold), w2 = width(t2, font: bold)
  let total = w1 + 6 + w2
  draw(t1, font: bold, color: white, x: (CGFloat(W) - total) / 2, y: 400, ctx: ctx)
  draw(t2, font: bold, color: gold, x: (CGFloat(W) - total) / 2 + w1 + 6, y: 400, ctx: ctx)
  let tag = "One episode. A month of content."
  draw(tag, font: med, color: muted, x: (CGFloat(W) - width(tag, font: med)) / 2, y: 310, ctx: ctx)
  write(ctx, "card-intro.png")
}

// END card
do {
  let ctx = makeCtx()
  ctx.setFillColor(bg); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
  glow(ctx, cx: 640, cy: 360, r: 700, c: CGColor(red: 0.91, green: 0.69, blue: 0.29, alpha: 0.06))
  let l1 = "Try it free — no signup"
  draw(l1, font: medBig, color: white, x: (CGFloat(W) - width(l1, font: medBig)) / 2, y: 420, ctx: ctx)
  let l2 = "episodekit.vercel.app"
  draw(l2, font: CTFontCreateWithName("HelveticaNeue-Bold" as CFString, 60, nil), color: gold, x: (CGFloat(W) - width(l2, font: CTFontCreateWithName("HelveticaNeue-Bold" as CFString, 60, nil))) / 2, y: 300, ctx: ctx)
  ctx.setFillColor(gold); ctx.fill(CGRect(x: 560, y: 250, width: 160, height: 5))
  write(ctx, "card-end.png")
}
