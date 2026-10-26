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

let bg = CGColor(red: 1, green: 1, blue: 1, alpha: 1)
let gold = CGColor(red: 0.14, green: 0.34, blue: 0.84, alpha: 1)   // #2457d6 accent
let white = CGColor(red: 0.06, green: 0.09, blue: 0.15, alpha: 1)  // ink text on light
let muted = CGColor(red: 0.45, green: 0.50, blue: 0.58, alpha: 1)


let bold = CTFontCreateWithName("HelveticaNeue-Bold" as CFString, 96, nil)
let med = CTFontCreateWithName("HelveticaNeue-Medium" as CFString, 40, nil)
let medBig = CTFontCreateWithName("HelveticaNeue-Medium" as CFString, 52, nil)

// INTRO card
do {
  let ctx = makeCtx()
  ctx.setFillColor(bg); ctx.fill(CGRect(x: 0, y: 0, width: W, height: H))
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
  let l1 = "Try it free — no signup"
  draw(l1, font: medBig, color: white, x: (CGFloat(W) - width(l1, font: medBig)) / 2, y: 420, ctx: ctx)
  let l2 = "episodekit.vercel.app"
  draw(l2, font: CTFontCreateWithName("HelveticaNeue-Bold" as CFString, 60, nil), color: gold, x: (CGFloat(W) - width(l2, font: CTFontCreateWithName("HelveticaNeue-Bold" as CFString, 60, nil))) / 2, y: 300, ctx: ctx)
  ctx.setFillColor(gold); ctx.fill(CGRect(x: 560, y: 250, width: 160, height: 5))
  write(ctx, "card-end.png")
}
