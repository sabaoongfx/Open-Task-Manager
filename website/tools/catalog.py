# Content for every page under website/tools/. Rendered by build.py.
# kind "gen": driven by tools.js (SVG generators). kind "util": driven by utils.js.

def btn(id, label, primary=False, ghost=True):
    cls = "btn btn-primary" if primary else "btn btn-ghost"
    return '<button class="%s" id="%s" type="button">%s</button>' % (cls, id, label)


def cp(target, label="Copy"):
    return '<button class="btn btn-ghost" data-copy="%s" type="button">%s</button>' % (target, label)


def ta(id, label, ro=False, ph="", cls=""):
    return '<label class="fld">%s<textarea id="%s" class="%s" spellcheck="false"%s%s></textarea></label>' % (
        label, id, cls, " readonly" if ro else "", ' placeholder="%s"' % ph if ph else "")


def copyrow(id, label):
    return ('<div class="copyrow"><span class="lbl">%s</span><input type="text" id="%s" readonly>%s</div>'
            % (label, id, cp(id)))


def chk(id, label, checked=False):
    return '<label class="chk"><input type="checkbox" id="%s"%s> %s</label>' % (id, " checked" if checked else "", label)


def sel(id, label, opts, w=""):
    o = "".join('<option value="%s">%s</option>' % (v, t) for v, t in opts)
    return '<label class="fld">%s<select id="%s"%s>%s</select></label>' % (label, id, ' style="width:%s"' % w if w else "", o)


def rng(id, label, lo, hi, val, unit="px", step=1):
    return ('<label class="fld">%s <span class="rangeval" id="v-%s">%s%s</span><input type="range" id="%s" min="%s" max="%s" step="%s" value="%s"></label>'
            % (label, id, val, unit, id, lo, hi, step, val))


MSG = '<div class="msg" id="msg" aria-live="polite"></div>'

GROUPS = [
    ("svg", "SVG and images"),
    ("color", "Color and CSS"),
    ("dev", "Developer tools"),
    ("everyday", "Text and everyday tools"),
]
APPCAT = {"svg": "DesignApplication", "color": "DesignApplication", "dev": "DeveloperApplication", "everyday": "UtilitiesApplication"}

TOOLS = [
    # ------------------------------------------------------------ SVG and images
    dict(kind="gen", group="svg", slug="random-svg-generator", tool="shapes", name="Random SVG Generator",
         title="Random SVG Generator: Free Online Shapes and Blobs",
         desc="Generate random SVG art in your browser: blobs, circles, rings and polygons in curated palettes. Copy the code or download SVG and PNG. Free, no sign-up.",
         h1="Random <em>SVG</em> generator",
         lede="Scatter random blobs, circles, rings, polygons and rounded squares into a clean vector image. Tweak the palette and count, then copy the SVG code or download it as SVG or PNG. It runs entirely in your browser.",
         short="Blobs, circles, rings and polygons in curated palettes. Copy the code or download SVG and PNG.",
         steps=["Pick a shape type, or leave it on <strong>Mixed</strong>, and set how many shapes you want.",
                "Choose a palette and a dark, light or transparent background.",
                "Press <strong>Randomize</strong> until you like the result. Each press gives a new seed.",
                "Use <strong>Copy SVG</strong> to paste the markup into your project, or download the file as SVG or PNG."],
         uses=["Placeholder artwork and hero backgrounds for prototypes and landing pages.",
               "Avatars, cover images and social cards that need a unique abstract graphic.",
               "Texture and pattern ideas for design exploration, opened afterwards in Figma, Illustrator or Inkscape.",
               "Generative art experiments: the same seed always gives the same image."],
         faq=[("What is a random SVG generator?", "It is a tool that builds a scalable vector graphic from randomly placed shapes. Because the output is SVG, it stays sharp at any size and can be edited in any vector editor or by hand in a text editor."),
              ("Is it free, and does it upload my images?", "It is free and there is no account. The image is created by JavaScript on your own device, and nothing is sent to a server."),
              ("What do I do with the seed?", "The seed is the code behind the randomness. Keep a seed and your settings and you will get exactly the same image again. Change the seed, or press Randomize, for a new one."),
              ("Can I use the images commercially?", "The tool does not add any licence or watermark and claims no rights over what it generates. You made the image, so you decide how to use it."),
              ("Can I edit the result afterwards?", "Yes. Download the SVG and open it in Figma, Illustrator, Inkscape or a code editor. Every shape is a plain path, circle, rectangle or polygon element.")]),
    dict(kind="gen", group="svg", slug="svg-wallpaper-generator", tool="wallpaper", name="SVG Wallpaper Generator",
         title="SVG Wallpaper Generator: Free Random Wallpapers up to 4K",
         desc="Create random desktop and phone wallpapers in your browser: gradient mesh, waves or low poly. Export SVG or PNG up to 4K. Free, nothing uploaded.",
         h1="SVG <em>wallpaper</em> generator",
         lede="Generate a one-of-a-kind wallpaper in three styles: soft gradient mesh, layered waves and low poly. Choose your screen size, export a crisp PNG up to 4K or keep the SVG, and set it as your desktop or phone background.",
         short="Gradient mesh, layered waves and low-poly wallpapers. Export PNG up to 4K or keep the SVG.",
         steps=["Pick a style: <strong>Gradient mesh</strong>, <strong>Layered waves</strong> or <strong>Low poly</strong>.",
                "Choose a size that matches your screen: Full HD, QHD, 4K, phone portrait or square.",
                "Select a palette, optionally add film grain, and press <strong>Randomize</strong> until it feels right.",
                "Click <strong>Download PNG</strong> for a wallpaper file, or <strong>Download SVG</strong> for a resolution-independent original."],
         uses=["Desktop wallpapers sized exactly for your monitor, including 1440p and 4K.",
               "Phone lock-screen and home-screen backgrounds in portrait 1080 x 1920.",
               "Backgrounds for slides, streams, video thumbnails and profile banners.",
               "Quick backgrounds for websites and apps, with no licence or watermark added by the tool."],
         faq=[("What sizes can I export?", "1920 x 1080, 2560 x 1440, 3840 x 2160, a 1080 x 1920 phone size and a 1080 x 1080 square. The SVG scales to any other size without losing quality."),
              ("How do I set the wallpaper on my computer?", "Download the PNG, then on Windows right-click it and choose Set as desktop background. On macOS use System Settings, Wallpaper, Add Photo. On most Linux desktops, right-click the file and choose the set-as-wallpaper option, or pick it in your desktop's appearance settings."),
              ("Why is a 4K PNG slow to create?", "The browser draws the whole image at full resolution before saving it. On a phone or an older laptop, 4K can take a few seconds and use a lot of memory. Use a smaller size if it fails."),
              ("What does film grain do?", "It adds a fine noise layer over the picture. This hides colour banding in smooth gradients and gives the wallpaper a printed feel."),
              ("Is anything uploaded?", "No. The wallpaper is built and saved entirely in your browser.")]),
    dict(kind="gen", group="svg", slug="animated-svg-generator", tool="animation", name="Animated SVG Generator",
         title="Animated SVG Generator: Free Looping SVG and Video",
         desc="Create looping animated SVGs in your browser: bubbles, pulse rings, orbits and morphing blobs. Download the SVG or record a video. Free, no uploads.",
         h1="Animated <em>SVG</em> generator",
         lede="Make a looping animation with no code: floating bubbles, pulse rings, orbits or a morphing blob. Download it as a self-contained animated SVG, or record it as a video. Everything happens in your browser.",
         short="Floating bubbles, pulse rings, orbits and morphing blobs. Download animated SVG or record video.",
         steps=["Pick an animation style and set the amount and speed.",
                "Choose a palette and press <strong>Randomize</strong> for a new composition.",
                "Click <strong>Download SVG</strong> for a single animated file that loops forever, or <strong>Copy SVG</strong> to paste the code.",
                "To get a video, choose a length and size and click <strong>Record video</strong>. Keep the tab open while it records."],
         uses=["Animated backgrounds and loaders for websites, using only an img tag or inline SVG.",
               "Lightweight motion for landing pages that avoids heavy video files.",
               "Looping visuals for streams, presentations and social posts, via the video export.",
               "Learning how SVG animation works by reading the generated code."],
         faq=[("How does the SVG animate without JavaScript or CSS?", "The animation is written into the SVG file itself using SMIL elements such as animate and animateTransform. Browsers play it on their own, including when the file is used in an img tag."),
              ("Can I get a video or GIF?", "The Record video button saves a WebM file in Chrome and Firefox, and an MP4 in Safari. GIF is not supported. To convert WebM to MP4 or GIF, use a tool such as ffmpeg."),
              ("Why did my recording stall?", "The recording runs in real time, so a browser that pauses a background tab can pause the animation too. Keep the tab visible until it finishes."),
              ("Does the animated SVG work everywhere?", "It plays in current Chrome, Edge, Firefox and Safari. Some editors and image viewers show only the first frame, because they do not implement SVG animation."),
              ("Is my data sent anywhere?", "No. The animation and the video are created on your device.")]),
    dict(kind="util", group="svg", slug="svg-to-png-converter", tool="svg-to-png", name="SVG to PNG Converter",
         title="SVG to PNG Converter: Free, Private, Any Size",
         desc="Convert SVG to PNG in your browser. Paste code or open a file, pick a scale or exact width, add a background and download. Nothing is uploaded.",
         h1="SVG to <em>PNG</em> converter",
         lede="Turn any SVG into a crisp PNG at the size you choose. Paste the code or open a file, set a scale or an exact width, optionally add a background colour, and download. The conversion happens on your device.",
         short="Paste or open an SVG, pick a size and download a PNG. Transparent backgrounds supported.",
         ui='''<div class="grid2"><div style="display:grid;gap:12px;align-content:start">%s
<div class="bar"><label class="btn btn-ghost" style="cursor:pointer">Open SVG file<input type="file" id="file" accept=".svg,image/svg+xml" hidden></label>%s</div></div>
<div style="display:grid;gap:12px;align-content:start">
<div class="grid2">%s<label class="fld">Or exact width (px)<input type="number" id="cw" min="1" max="16000" placeholder="auto"></label></div>
<div class="bar">%s<input type="color" id="bg" value="#ffffff" aria-label="Background colour"></div>
%s<canvas id="cnv" class="cnv" hidden></canvas></div></div>%s''' % (
             ta("in", "SVG code", ph="&lt;svg xmlns=&quot;http://www.w3.org/2000/svg&quot; ..."), btn("sample", "Try a sample"),
             sel("scale", "Scale", [("1", "1x"), ("2", "2x"), ("3", "3x"), ("4", "4x"), ("8", "8x")]),
             chk("bgon", "Fill background"), btn("dl", "Download PNG", True), MSG),
         steps=["Paste your SVG code into the box, or click <strong>Open SVG file</strong>.", "Choose a scale (2x is good for sharp screens) or type an exact width in pixels.", "Turn on <strong>Fill background</strong> if you need a solid colour instead of transparency.", "Press <strong>Download PNG</strong>."],
         uses=["Making PNG logos and icons for places that don't accept SVG, such as some email clients and social networks.", "Exporting favicons, app icons and Open Graph images at exact sizes.", "Rasterising generated SVG art, charts and diagrams for slides and documents.", "Checking how an SVG renders in a browser."],
         faq=[("Is my SVG uploaded anywhere?", "No. The SVG is drawn onto a canvas by your browser and saved as a PNG on your device."),
              ("Why is my PNG blurry?", "A PNG has a fixed number of pixels. Increase the scale or enter a larger exact width. The SVG itself never loses sharpness."),
              ("Does it keep transparency?", "Yes, by default the background stays transparent. Turn on Fill background to add a solid colour."),
              ("Why did my SVG fail to render?", "SVGs that load external images, fonts or stylesheets can't be drawn to a canvas for security reasons. Inline those resources, or convert text to paths in your editor first."),
              ("What is the largest size I can export?", "Browsers limit canvas size, so the tool caps width at 16,000 pixels. Very large images can still run out of memory on phones.")]),
    dict(kind="util", group="svg", slug="image-compressor", tool="image-compressor", name="Image Compressor",
         title="Image Compressor: Shrink JPG, PNG and WebP Privately",
         desc="Compress and resize JPG, PNG and WebP images in your browser. Adjust quality, see the saving instantly and download. Your photos never leave your device.",
         h1="Image <em>compressor</em>",
         lede="Make photos and graphics smaller without uploading them anywhere. Choose a format and quality, optionally limit the width, compare the file sizes and download the result.",
         short="Shrink JPG, PNG and WebP images and resize them. Your files never leave your device.",
         ui='''<div class="drop" id="drop"><div>Drop an image here, or</div><label class="btn btn-primary" style="cursor:pointer">Choose image<input type="file" id="file" accept="image/*" hidden></label></div>
<div class="grid3">%s%s%s</div>
<div class="grid2"><div style="display:grid;gap:12px;align-content:start"><div id="stats"></div>%s<div class="bar">%s</div></div><div><img id="prev" class="imgprev" alt="Compressed preview" hidden></div></div>''' % (
             sel("fmt", "Output format", [("image/jpeg", "JPEG"), ("image/webp", "WebP"), ("image/png", "PNG (lossless)")]),
             '<label class="fld">Quality <span class="rangeval" id="qv">75%</span><input type="range" id="q" min="10" max="100" value="75"></label>',
             '<label class="fld">Max width (px)<input type="number" id="mw" min="1" placeholder="original"></label>',
             MSG, '<button class="btn btn-primary" id="dl" type="button" disabled>Download</button>'),
         steps=["Drop an image onto the box or click <strong>Choose image</strong>.", "Pick WebP or JPEG for the smallest files, or PNG to keep every pixel.", "Lower the quality slider, or set a maximum width, until the preview still looks good.", "Check the size saving and click <strong>Download</strong>."],
         uses=["Making website images smaller so pages load faster.", "Reducing photos to fit email attachment and form upload limits.", "Resizing large camera images to a sensible width.", "Converting between JPEG, PNG and WebP."],
         faq=[("Are my images uploaded?", "No. The image is decoded, resized and re-encoded by your browser. Nothing leaves your device."),
              ("Which format gives the smallest file?", "WebP is usually smallest, then JPEG for photos. PNG is lossless, so it is often larger and ignores the quality slider."),
              ("Why did my file get bigger?", "Re-encoding an already well-compressed image, or converting a JPEG to PNG, can increase the size. Lower the quality, reduce the width or choose WebP."),
              ("Is metadata such as EXIF removed?", "Yes. Drawing the image onto a canvas drops camera metadata, including location, which is useful before sharing a photo."),
              ("Is transparency kept?", "PNG and WebP keep transparency. JPEG has none, so transparent areas become white.")]),
    # ------------------------------------------------------------ Color and CSS
    dict(kind="util", group="color", slug="color-converter", tool="color-converter", name="Color Converter",
         title="Color Converter: HEX, RGB, HSL, HSV and CMYK",
         desc="Convert colors between HEX, RGB, HSL, HSV and CMYK, with a color picker and WCAG contrast check. Accepts color names too. Free, runs in your browser.",
         h1="Color <em>converter</em>",
         lede="Type a color in any common format, or pick one, and get every other format instantly. It also checks the contrast against white and black text so you know whether it is readable.",
         short="Convert HEX, RGB, HSL, HSV and CMYK, with a picker and contrast check.",
         ui='''<div class="grid2"><div style="display:grid;gap:14px;align-content:start">
<label class="fld">Color (HEX, RGB, HSL or name)<div class="colorbar"><input type="color" id="pick" value="#e93233" aria-label="Pick a color"><input type="text" id="in" class="mono" spellcheck="false"></div></label>
<div class="bar">%s</div>%s<div class="big-sw" id="sw"></div></div>
<div>%s%s%s%s%s
<table class="kv" style="margin-top:14px"><tr><th>White text</th><td id="cw"></td></tr><tr><th>Black text</th><td id="cb"></td></tr></table></div></div>''' % (
             btn("rand", "Random color"), MSG, copyrow("o-hex", "HEX"), copyrow("o-rgb", "RGB"), copyrow("o-hsl", "HSL"), copyrow("o-hsv", "HSV"), copyrow("o-cmyk", "CMYK")),
         steps=["Type or paste a color such as <span class=\"mono\">#1a73e8</span>, <span class=\"mono\">rgb(26 115 232)</span> or <span class=\"mono\">tomato</span>, or use the picker.", "Read the HEX, RGB, HSL, HSV and CMYK values and click <strong>Copy</strong> next to the one you need.", "Check the contrast rows: WCAG AA needs at least 4.5:1 for normal text."],
         uses=["Moving a brand color between design tools and CSS.", "Finding the HSL values to build lighter and darker shades.", "Checking whether text on a background meets accessibility guidelines.", "Turning a named CSS color into HEX."],
         faq=[("Which formats can I type in?", "HEX (3, 4, 6 or 8 digits), rgb() and rgba(), hsl() and hsla(), and CSS color names such as rebeccapurple. Your browser does the parsing."),
              ("Is the CMYK value exact?", "No. CMYK here is a simple mathematical conversion from RGB, useful as a starting point. Print profiles use colour management, so check printed results with your printer."),
              ("What do the contrast ratios mean?", "WCAG asks for at least 4.5:1 for normal text (AA) and 7:1 for the stricter AAA level. Large text needs 3:1 for AA."),
              ("Does it keep transparency?", "Yes. If you enter an alpha value, the HEX output gains two extra digits and the RGB output becomes rgba().")]),
    dict(kind="util", group="color", slug="color-palette-generator", tool="color-palette-generator", name="Color Palette Generator",
         title="Color Palette Generator: Harmonies from Any Color",
         desc="Generate color palettes from a base color: complementary, analogous, triadic, tetradic and monochrome. Copy HEX codes or CSS variables. Free and private.",
         h1="Color <em>palette</em> generator",
         lede="Pick a base color and a harmony rule and get a five-color palette that works together. Click any swatch to copy its HEX code, or copy the whole set as CSS variables or JSON.",
         short="Build five-color palettes from a base color using classic harmony rules.",
         ui='''<div class="bar"><label class="fld inline">Base <input type="color" id="base" value="#e93233" aria-label="Base color"></label>
<label class="fld inline">Harmony %s</label>%s</div>
<div class="swatches" id="swatches"></div>
<div class="grid2">%s%s</div>
<div class="bar">%s%s</div>''' % (
             '<select id="kind" style="width:auto"><option value="analogous">Analogous</option><option value="complementary">Complementary</option><option value="triadic">Triadic</option><option value="tetradic">Tetradic</option><option value="split">Split complementary</option><option value="mono">Monochrome</option></select>',
             btn("rand", "Random base", True), ta("css", "CSS variables", True, cls="short"), ta("json", "JSON", True, cls="short"), cp("css", "Copy CSS"), cp("json", "Copy JSON")),
         steps=["Pick a base color with the color box, or press <strong>Random base</strong>.", "Choose a harmony: analogous for calm, complementary for contrast, triadic for variety.", "Click a swatch to copy its HEX code.", "Copy the full palette as CSS variables or JSON for your project."],
         uses=["Starting a brand or website colour scheme.", "Finding accent colours that suit an existing primary colour.", "Making chart and illustration palettes.", "Exploring colour ideas quickly with the random button."],
         faq=[("What is an analogous palette?", "Colours that sit next to each other on the colour wheel, about 30 degrees apart. They feel harmonious and calm."),
              ("What is a complementary palette?", "Two colours opposite each other on the wheel. They give the strongest contrast, so use one as the main colour and the other sparingly as an accent."),
              ("Why are some swatches lighter or darker versions of my color?", "Some harmonies produce fewer than five hues. The tool fills the rest with tints and shades so you always get five colours."),
              ("Can I use the palettes freely?", "Yes. Colours are not copyrightable and the tool claims no rights over what it produces.")]),
    dict(kind="util", group="color", slug="css-gradient-generator", tool="css-gradient-generator", name="CSS Gradient Generator",
         title="CSS Gradient Generator: Linear, Radial and Conic",
         desc="Build CSS gradients visually: linear, radial or conic, with up to six color stops and an angle slider. Copy the ready-made CSS. Free, in your browser.",
         h1="CSS <em>gradient</em> generator",
         lede="Design a gradient with a live preview, then copy the CSS. Choose linear, radial or conic, set the angle, and add up to six color stops.",
         short="Visual builder for linear, radial and conic CSS gradients with copy-ready code.",
         ui='''<div class="grid2"><div style="display:grid;gap:14px;align-content:start">
<div class="grid2">%s<label class="fld">Angle <span class="rangeval" id="av">135°</span><input type="range" id="angle" min="0" max="360" value="135"></label></div>
<div id="stops" style="display:grid;gap:10px"></div>
<div class="bar">%s%s</div></div>
<div style="display:grid;gap:14px;align-content:start"><div class="prev-box" id="prev"></div>%s<div class="bar">%s</div></div></div>''' % (
             sel("type", "Type", [("linear", "Linear"), ("radial", "Radial"), ("conic", "Conic")]),
             btn("add", "Add stop"), btn("rand", "Random gradient", True), ta("out", "CSS", True, cls="short"), cp("out", "Copy CSS")),
         steps=["Choose a gradient type and set the angle (it applies to linear and conic).", "Change each stop's colour and position, or click <strong>Add stop</strong> for more colours.", "Press <strong>Random gradient</strong> for ideas.", "Click <strong>Copy CSS</strong> and paste it into your stylesheet."],
         uses=["Hero sections, buttons and cards with a gradient background.", "Quickly trying colour combinations before committing them to a design.", "Learning the syntax of linear-gradient, radial-gradient and conic-gradient.", "Making gradient borders and text backgrounds."],
         faq=[("What is the difference between linear, radial and conic gradients?", "A linear gradient blends colours along a straight line, a radial gradient spreads outward from a centre point, and a conic gradient sweeps around a centre like a colour wheel."),
              ("Is the CSS supported in all browsers?", "Linear and radial gradients work everywhere. Conic gradients are supported in all current major browsers."),
              ("How do I use the output?", "Paste the line into a CSS rule, for example on a div or the body. It sets the background property."),
              ("Can I make a hard-edged stripe?", "Yes. Give two neighbouring stops the same position and the colour changes sharply there.")]),
    dict(kind="util", group="color", slug="box-shadow-generator", tool="box-shadow-generator", name="CSS Box Shadow Generator",
         title="CSS Box Shadow Generator: Visual Builder with Presets",
         desc="Design CSS box-shadows with live preview: offset, blur, spread, color, opacity and inset. Start from presets and copy the CSS. Free, no sign-up.",
         h1="CSS <em>box shadow</em> generator",
         lede="Tune a box-shadow with sliders and see it update live. Start from a preset such as subtle, layered, hard or glow, then copy the CSS.",
         short="Visual box-shadow builder with presets, inset support and copy-ready CSS.",
         ui='''<div class="grid2"><div style="display:grid;gap:12px;align-content:start">
%s%s%s%s
<div class="grid3"><label class="fld">Shadow<input type="color" id="color" value="#000000"></label>%s<label class="chk" style="align-self:end"><input type="checkbox" id="inset"> Inset</label></div>
<div class="grid3"><label class="fld">Page<input type="color" id="bg" value="#f6f4ef"></label><label class="fld">Box<input type="color" id="boxc" value="#ffffff"></label>%s</div>
<div class="bar">
<button class="btn btn-ghost" type="button" data-preset="subtle">Subtle</button><button class="btn btn-ghost" type="button" data-preset="layered">Layered</button><button class="btn btn-ghost" type="button" data-preset="hard">Hard</button><button class="btn btn-ghost" type="button" data-preset="glow">Glow</button><button class="btn btn-ghost" type="button" data-preset="inner">Inner</button></div></div>
<div style="display:grid;gap:14px;align-content:start"><div class="stage-sh" id="stage"><div id="box"></div></div>%s<div class="bar">%s</div></div></div>''' % (
             rng("x", "Horizontal offset", -50, 50, 0), rng("y", "Vertical offset", -50, 50, 10), rng("blur", "Blur", 0, 100, 30), rng("spread", "Spread", -50, 50, -5),
             rng("op", "Opacity", 0, 100, 25, "%"), rng("radius", "Radius", 0, 80, 16),
             ta("out", "CSS", True, cls="short"), cp("out", "Copy CSS")),
         steps=["Pick a preset or move the offset, blur and spread sliders.", "Set the shadow colour and opacity. Soft shadows usually use black at 10 to 30 percent.", "Use the page and box colours to preview it on your own background.", "Click <strong>Copy CSS</strong> and paste the box-shadow line into your stylesheet."],
         uses=["Cards, buttons, modals and dropdowns that need depth.", "Glow effects for focus states and highlighted items.", "Inset shadows for pressed buttons and input fields.", "Checking how a shadow looks on light and dark backgrounds."],
         faq=[("What do the box-shadow values mean?", "In order: horizontal offset, vertical offset, blur radius, spread radius and colour. The optional inset keyword draws the shadow inside the box."),
              ("What does spread do?", "Positive spread grows the shadow beyond the box, negative spread shrinks it. A negative spread with a larger blur gives a soft, realistic lift."),
              ("Can I layer several shadows?", "Yes, in CSS you can list several shadows separated by commas. Copy the output and add more by hand for layered effects."),
              ("Do shadows affect performance?", "Large blurs on many animated elements can be costly. For ordinary static cards the cost is negligible.")]),
    # ------------------------------------------------------------ Developer tools
    dict(kind="util", group="dev", slug="json-formatter", tool="json-formatter", name="JSON Formatter and Validator",
         title="JSON Formatter and Validator: Free, Private, Instant",
         desc="Format, validate and minify JSON in your browser, with error line and column. Sort keys and copy the result. Your data is never uploaded.",
         h1="JSON <em>formatter</em> and validator",
         lede="Paste JSON to pretty-print it, check that it is valid, or minify it. Errors show the line and column. The data stays in your browser, so it is safe to use with private payloads.",
         short="Pretty-print, validate and minify JSON with error positions. Nothing is uploaded.",
         ui='''<div class="grid2">%s%s</div>
<div class="bar">%s%s%s<label class="fld inline">Indent <select id="indent" style="width:auto"><option value="2">2 spaces</option><option value="4">4 spaces</option><option value="tab">Tab</option></select></label>%s%s%s%s</div>%s''' % (
             ta("in", "Input", ph='{"paste": "JSON here"}'), ta("out", "Output", True),
             btn("fmt", "Format", True), btn("min", "Minify"), "", chk("sort", "Sort keys"), btn("sample", "Sample"), btn("clear", "Clear"), cp("out", "Copy output"), MSG),
         steps=["Paste your JSON into the Input box.", "Press <strong>Format</strong> to pretty-print it, or <strong>Minify</strong> to remove all whitespace.", "If it is invalid, the message shows the line and column of the problem.", "Click <strong>Copy output</strong> to use the result."],
         uses=["Reading minified API responses and log lines.", "Finding the typo in a config file that won't parse.", "Shrinking JSON before pasting it into a request or a test.", "Sorting keys so two JSON files can be compared line by line."],
         faq=[("Is my JSON sent to a server?", "No. It is parsed by your browser's own JSON parser and never leaves the page, so it is fine for tokens, customer data and internal payloads."),
              ("Why does my JSON say invalid?", "Common causes are trailing commas, single quotes instead of double quotes, unquoted keys, comments and missing brackets. JSON is stricter than JavaScript object syntax."),
              ("Does it handle large files?", "It handles several megabytes comfortably. Very large inputs can slow the page because the text boxes have to render the whole result."),
              ("What does Sort keys do?", "It sorts object keys alphabetically at every level, which makes two JSON documents easier to compare. Arrays keep their order.")]),
    dict(kind="util", group="dev", slug="base64-encoder-decoder", tool="base64", name="Base64 Encoder and Decoder",
         title="Base64 Encode and Decode Online: UTF-8 and URL-safe",
         desc="Encode text to Base64 or decode Base64 back to text, with full UTF-8 and URL-safe support. Runs in your browser; nothing is uploaded or logged.",
         h1="Base64 <em>encoder</em> and decoder",
         lede="Convert text to Base64 and back instantly. It handles emoji and non-English text correctly, and can produce URL-safe Base64 without padding.",
         short="Encode and decode Base64 with UTF-8 and URL-safe support.",
         ui='''<div class="bar">%s%s%s</div><div class="grid2">%s%s</div>%s''' % (
             sel("mode", "Mode", [("encode", "Encode to Base64"), ("decode", "Decode from Base64")], "auto"), chk("urlsafe", "URL-safe (- and _, no padding)"), btn("swap", "Swap input and output") + cp("out", "Copy output"),
             ta("in", "Input"), ta("out", "Output", True), MSG),
         steps=["Choose <strong>Encode</strong> or <strong>Decode</strong>.", "Type or paste into the Input box. The result updates as you type.", "Turn on URL-safe if the result goes into a URL or a JWT.", "Use <strong>Swap</strong> to feed the output back in, or <strong>Copy output</strong>."],
         uses=["Reading Base64 values in API responses, config files and emails.", "Embedding small text or data in JSON, HTML or CSS.", "Preparing HTTP Basic auth style values for testing.", "Inspecting the parts of a JWT, which use URL-safe Base64."],
         faq=[("What is Base64?", "A way to write binary or text data using only 64 safe characters (letters, digits, plus and slash). It makes data safe to put in text formats, but it is not encryption."),
              ("Is Base64 secure?", "No. Anyone can decode it, so never use it to hide secrets."),
              ("Does it support emoji and accented letters?", "Yes. Text is converted to UTF-8 bytes before encoding, and decoded the same way, so all Unicode text round-trips correctly."),
              ("What is URL-safe Base64?", "A variant that replaces + with - and / with _, and drops the = padding, so the value can sit in a URL or filename without escaping.")]),
    dict(kind="util", group="dev", slug="url-encoder-decoder", tool="url-encoder", name="URL Encoder and Decoder",
         title="URL Encoder and Decoder: Percent-Encode Online",
         desc="Encode or decode URLs and query strings with percent-encoding. Choose component or full-URL mode. Runs in your browser, nothing is uploaded.",
         h1="URL <em>encoder</em> and decoder",
         lede="Percent-encode text for use in a URL, or decode a messy encoded link back into readable text. Pick component mode for query values or full-URL mode for whole links.",
         short="Percent-encode and decode URLs and query values.",
         ui='''<div class="bar">%s%s</div><div class="grid2">%s%s</div>%s''' % (
             sel("mode", "Mode", [("component", "Encode component (query value)"), ("full", "Encode full URL"), ("decode", "Decode")], "auto"), chk("plus", "Treat + as space when decoding", True),
             ta("in", "Input"), ta("out", "Output", True) , MSG) + '<div class="bar">%s</div>' % cp("out", "Copy output"),
         steps=["Choose a mode: encode a component, encode a full URL, or decode.", "Type or paste your text. The result appears immediately.", "Click <strong>Copy output</strong> to use it."],
         uses=["Building query strings with special characters, spaces and non-English text.", "Reading tracking links and redirects full of %20 and %3D.", "Debugging API calls where a parameter gets mangled.", "Preparing mailto: and share links."],
         faq=[("What is the difference between component and full URL mode?", "Component mode (encodeURIComponent) escapes everything that is not a letter, digit or a few safe symbols, including / ? & and =, which is right for a single parameter value. Full URL mode (encodeURI) leaves those structural characters alone so a whole link stays usable."),
              ("Why does a space become %20 or +?", "Percent-encoding writes a space as %20. In HTML form submissions a space is sometimes written as +, so decoding offers an option to treat + as a space."),
              ("Why can't it decode my text?", "A % sign that isn't followed by two hex digits is invalid. Fix or remove the stray % and try again."),
              ("Is my data uploaded?", "No. Encoding and decoding use your browser's built-in functions on your device.")]),
    dict(kind="util", group="dev", slug="uuid-generator", tool="uuid-generator", name="UUID Generator",
         title="UUID Generator: Random v4 and Time-Ordered v7",
         desc="Generate UUIDs in bulk: random v4 or time-ordered v7. Choose uppercase or no hyphens and copy the list. Uses your browser's secure random generator.",
         h1="UUID <em>generator</em>",
         lede="Create one or hundreds of UUIDs at once. Pick random version 4, or version 7 that sorts by creation time, and copy the list. Values come from your browser's cryptographically secure random generator.",
         short="Generate v4 and v7 UUIDs in bulk with formatting options.",
         ui='''<div class="bar">%s<label class="fld" style="width:110px">Count<input type="number" id="count" min="1" max="500" value="5"></label>%s%s%s</div>%s<div class="bar">%s</div>''' % (
             sel("ver", "Version", [("4", "v4 (random)"), ("7", "v7 (time-ordered)")], "auto"), chk("nohy", "No hyphens"), chk("upper", "Uppercase"), btn("gen", "Generate", True),
             ta("out", "UUIDs", True, cls=""), cp("out", "Copy all")),
         steps=["Choose version 4 or version 7 and how many UUIDs you need (up to 500).", "Optionally remove the hyphens or switch to uppercase.", "Press <strong>Generate</strong>, then <strong>Copy all</strong>."],
         uses=["Test data and fixtures for databases and APIs.", "Unique IDs for records, files and sessions.", "Time-sortable IDs (v7) for database keys that index well.", "Placeholders while you design a schema."],
         faq=[("What is the difference between UUID v4 and v7?", "Version 4 is almost entirely random. Version 7 starts with a millisecond timestamp followed by random bits, so IDs created later sort later, which is friendlier to database indexes."),
              ("Can two UUIDs collide?", "With 122 random bits in a v4 UUID, the chance of an accidental collision is negligible in practice."),
              ("Are they generated securely?", "Yes. The tool uses crypto.getRandomValues, the same source browsers use for cryptography."),
              ("Are UUIDs secret?", "Don't rely on them as secrets. They are identifiers, and v7 even reveals when it was created.")]),
    dict(kind="util", group="dev", slug="hash-generator", tool="hash-generator", name="Hash Generator",
         title="Hash Generator: SHA-1, SHA-256, SHA-384 and SHA-512",
         desc="Generate SHA-1, SHA-256, SHA-384 and SHA-512 hashes of text or files in your browser. Nothing is uploaded, so it is safe for private files.",
         h1="Hash <em>generator</em>",
         lede="Get SHA-1, SHA-256, SHA-384 and SHA-512 hashes of any text or file. Hashing happens on your device with the browser's built-in crypto, so even large private files never leave your computer.",
         short="SHA-1, SHA-256, SHA-384 and SHA-512 hashes of text or files, computed locally.",
         ui='''%s<div class="bar"><label class="btn btn-ghost" style="cursor:pointer">Hash a file<input type="file" id="file" hidden></label>%s</div>%s%s%s%s%s''' % (
             ta("in", "Text", cls="short", ph="Type or paste text to hash"), chk("upper", "Uppercase"),
             copyrow("h-SHA-1", "SHA-1"), copyrow("h-SHA-256", "SHA-256"), copyrow("h-SHA-384", "SHA-384"), copyrow("h-SHA-512", "SHA-512"), MSG),
         steps=["Type or paste text, or click <strong>Hash a file</strong>.", "Read the SHA-1, SHA-256, SHA-384 and SHA-512 values.", "Click <strong>Copy</strong> next to the hash you need and compare it with the published checksum."],
         uses=["Verifying a downloaded installer against its published SHA-256 checksum.", "Checking that two files are identical.", "Generating hashes for integrity attributes and test data.", "Learning how a tiny change in input completely changes a hash."],
         faq=[("Which hash should I use?", "Use SHA-256 or stronger for checksums and integrity. SHA-1 is broken for security purposes and is only included for compatibility."),
              ("Can I hash passwords with this?", "Don't. Plain SHA hashes are too fast for storing passwords. Use a purpose-built password hashing function such as Argon2, scrypt or bcrypt on your server."),
              ("Is my file uploaded?", "No. It is read and hashed by your browser, and nothing is sent anywhere."),
              ("Why is MD5 missing?", "Browsers don't include MD5 in their crypto API because it is considered insecure. The SHA family covers every modern checksum use.")]),
    dict(kind="util", group="dev", slug="jwt-decoder", tool="jwt-decoder", name="JWT Decoder",
         title="JWT Decoder: Inspect JSON Web Tokens Privately",
         desc="Decode JWTs in your browser: see the header, payload and expiry. Tokens are never uploaded. A free, private JSON Web Token decoder.",
         h1="JWT <em>decoder</em>",
         lede="Paste a JSON Web Token to read its header and payload and see when it was issued and when it expires. The token is decoded on your device and is never sent anywhere.",
         short="Decode JWT headers and payloads and check expiry. Tokens stay in your browser.",
         ui='''%s%s<div id="claims"></div><div class="grid2">%s%s</div>''' % (
             ta("in", "Token", cls="short", ph="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."), MSG, ta("hdr", "Header", True, cls="short"), ta("pay", "Payload", True)),
         steps=["Paste the token into the box. A leading <span class=\"mono\">Bearer</span> is ignored.", "Read the decoded header and payload.", "Check the issued-at and expiry times shown under the box."],
         uses=["Debugging authentication problems and checking claims such as sub, aud and scope.", "Finding out why a token is rejected, for example because it has expired.", "Learning how JWTs are structured.", "Reading tokens without pasting them into an online service that logs them."],
         faq=[("Does this verify the signature?", "No. It only decodes the token. Verifying a signature needs the secret or public key and should be done by your server. Never trust a token's contents based on decoding alone."),
              ("Is it safe to paste a real token?", "The token is processed entirely in your browser and not sent anywhere. Even so, treat live tokens as secrets and prefer tokens from test environments."),
              ("Why is the payload readable by anyone?", "A JWT is signed, not encrypted. Its payload is only Base64URL-encoded, so don't put secrets in it."),
              ("What are exp, iat and nbf?", "Expiry time, issued-at time and not-before time, as Unix timestamps in seconds. The tool converts them to readable dates.")]),
    dict(kind="util", group="dev", slug="regex-tester", tool="regex-tester", name="Regex Tester",
         title="Regex Tester: Test JavaScript Regular Expressions Live",
         desc="Test JavaScript regular expressions with live highlighting, match positions, capture groups and flags. Free, private and instant, in your browser.",
         h1="Regex <em>tester</em>",
         lede="Write a regular expression and see every match highlighted as you type, with positions and capture groups listed below. It uses your browser's JavaScript regex engine.",
         short="Live JavaScript regex testing with highlighted matches and capture groups.",
         ui='''<div class="bar"><label class="fld" style="flex:1;min-width:220px">Pattern<input type="text" id="pat" class="mono" spellcheck="false" placeholder="(\w+)@example\.com"></label></div>
<div class="bar">%s%s%s%s%s</div>%s
<div class="grid2"><div>%s<div class="fld" style="margin-top:12px">Highlighted<div class="box" id="hl"></div></div></div><div class="fld">Matches<ul class="matches" id="matches"></ul></div></div>''' % (
             chk("f-g", "g global", True), chk("f-i", "i ignore case"), chk("f-m", "m multiline"), chk("f-s", "s dotAll"), chk("f-u", "u unicode"), MSG,
             ta("txt", "Test string", cls="short", ph="Paste the text to search")),
         steps=["Type your pattern in the Pattern box, without the surrounding slashes.", "Tick the flags you need. <span class=\"mono\">g</span> finds all matches, <span class=\"mono\">i</span> ignores case.", "Paste your text. Matches are highlighted and listed with their position and groups."],
         uses=["Building and debugging patterns before putting them in code.", "Extracting parts of log lines and URLs with capture groups.", "Checking validation patterns against sample input.", "Learning regex by experimenting."],
         faq=[("Which regex flavour does it use?", "JavaScript (ECMAScript), the engine built into your browser. Patterns written for PCRE, Python or .NET may need small changes, for example around lookbehind or named group syntax."),
              ("What do the flags mean?", "g finds all matches, i ignores case, m makes ^ and $ match at line breaks, s lets . match newlines, and u enables full Unicode matching."),
              ("Why did the page freeze?", "Some patterns, such as nested quantifiers like (a+)+, can take exponential time on certain input, called catastrophic backtracking. Simplify the pattern or limit the test text."),
              ("Is my text uploaded?", "No. Matching runs entirely in your browser.")]),
    dict(kind="util", group="dev", slug="unix-timestamp-converter", tool="timestamp-converter", name="Unix Timestamp Converter",
         title="Unix Timestamp Converter: Epoch to Date and Back",
         desc="Convert Unix timestamps (seconds or milliseconds) to readable dates and back. See UTC, local time and relative time, with a live current epoch.",
         h1="Unix <em>timestamp</em> converter",
         lede="Turn an epoch timestamp into a human-readable date, or pick a date and get its timestamp. Seconds and milliseconds are detected automatically, and results are shown in UTC and your own time zone.",
         short="Convert epoch seconds or milliseconds to dates, and dates back to timestamps.",
         ui='''<div class="msg">Current Unix time: <b id="live" style="color:var(--ink)"></b></div>
<div class="grid2"><label class="fld">Timestamp or date<input type="text" id="ts" class="mono" spellcheck="false"></label><label class="fld">Or pick a date and time (your time zone)<input type="datetime-local" id="dt"></label></div>
<div class="bar">%s</div>%s<div id="res"></div>''' % (btn("now", "Use current time", True), MSG),
         steps=["Paste a Unix timestamp in seconds or milliseconds, or click <strong>Use current time</strong>.", "Or choose a date and time with the picker to get its timestamp.", "Read the UTC, local and relative results below."],
         uses=["Reading timestamps in logs, databases and API responses.", "Working out when a token or cache entry expires.", "Converting a date to epoch time for a query or script.", "Checking the time difference between two events."],
         faq=[("What is a Unix timestamp?", "The number of seconds since 1 January 1970 00:00:00 UTC, also called epoch time. Many systems use milliseconds instead."),
              ("How does it tell seconds from milliseconds?", "Values of 100 billion or more are treated as milliseconds, since that would be a date far in the future in seconds. Smaller values are seconds."),
              ("Which time zone is used?", "UTC and your own browser time zone are both shown, so you can compare them."),
              ("What is the year 2038 problem?", "Systems that store the timestamp as a signed 32-bit integer overflow on 19 January 2038. Modern systems use 64-bit values and are unaffected.")]),
    dict(kind="util", group="dev", slug="text-diff-checker", tool="diff-checker", name="Text Diff Checker",
         title="Text Diff Checker: Compare Two Texts Side by Side",
         desc="Compare two texts or code snippets and see added and removed lines highlighted. Ignore whitespace or case. Free, private, runs in your browser.",
         h1="Text <em>diff</em> checker",
         lede="Paste two versions of a text, config or piece of code and see exactly which lines were added or removed. Nothing is uploaded, so it is safe for private files.",
         short="Line-by-line comparison of two texts with added and removed lines highlighted.",
         ui='''<div class="grid2">%s%s</div><div class="bar">%s%s%s</div>%s<div class="box" id="out" style="max-height:480px"></div>''' % (
             ta("a", "Original", cls="short"), ta("b", "Changed", cls="short"), chk("ws", "Ignore whitespace differences"), chk("ic", "Ignore case"), btn("swap", "Swap sides"), MSG),
         steps=["Paste the original text on the left and the changed text on the right.", "Added lines are green with a plus sign, removed lines are red with a minus.", "Use the options to ignore whitespace or letter case."],
         uses=["Comparing two versions of a config file or document.", "Spotting what changed between two API responses.", "Checking edits before committing or sending them.", "Comparing exported lists or logs."],
         faq=[("How does it compare the texts?", "It compares line by line using a longest-common-subsequence algorithm, the same idea behind the Unix diff tool, so unchanged lines are matched up even when text moves around."),
              ("Is there a size limit?", "Very large inputs with little in common can be too heavy for a browser. The tool tells you when to compare smaller sections."),
              ("Does it highlight changes inside a line?", "No, it works on whole lines. A changed line shows as one removed line and one added line."),
              ("Is my text uploaded?", "No. The comparison is done in your browser.")]),
    # ------------------------------------------------------------ everyday
    dict(kind="util", group="everyday", slug="qr-code-generator", tool="qr-code-generator", name="QR Code Generator",
         title="QR Code Generator: Free, No Sign-Up, Download SVG and PNG",
         desc="Create QR codes for links, text and Wi-Fi in your browser. Custom colors; download SVG or PNG. No sign-up and no expiry.",
         h1="QR code <em>generator</em>",
         lede="Make a QR code for a link, some text or your Wi-Fi network and download it as a sharp SVG or a high-resolution PNG. Codes are generated on your device, never expire and have no tracking.",
         short="QR codes for links, text and Wi-Fi with custom colors, as SVG or PNG. No expiry.",
         ui='''<div class="grid2"><div style="display:grid;gap:12px;align-content:start">
%s
<label class="fld" id="f-text">Text or link<textarea id="text" class="short" spellcheck="false"></textarea></label>
<div id="f-wifi" style="display:grid;gap:12px" hidden><label class="fld">Network name (SSID)<input type="text" id="ssid"></label><label class="fld">Password<input type="text" id="pw" autocomplete="off"></label>%s</div>
<div class="grid3">%s<label class="fld">Margin<input type="number" id="margin" min="0" max="10" value="2"></label><div class="grid2" style="gap:8px"><label class="fld">Dark<input type="color" id="fg" value="#000000"></label><label class="fld">Light<input type="color" id="bg" value="#ffffff"></label></div></div></div>
<div style="display:grid;gap:12px;align-content:start"><div class="qrbox" id="qr"></div>%s<div class="bar">%s%s</div></div></div>''' % (
             sel("kind", "Content", [("text", "Text or link"), ("wifi", "Wi-Fi network")]),
             sel("sec", "Security", [("WPA", "WPA/WPA2/WPA3"), ("WEP", "WEP"), ("nopass", "None")]),
             sel("ec", "Error correction", [("M", "Medium (15%)"), ("L", "Low (7%)"), ("Q", "Quartile (25%)"), ("H", "High (30%)")]),
             MSG, btn("dl-svg", "Download SVG", True), btn("dl-png", "Download PNG")),
         steps=["Choose <strong>Text or link</strong> or <strong>Wi-Fi network</strong> and enter the content.", "Pick colours if you like. Keep strong contrast with a dark code on a light background.", "Raise error correction if you plan to print it small or add a logo over it.", "Download the SVG for print, or the PNG for screens, and test it with your phone camera."],
         uses=["Linking printed material, posters and packaging to a web page.", "Sharing Wi-Fi details with guests without spelling out the password.", "Sending a link from a computer screen to a phone.", "Putting contact details or a short note on a sticker."],
         faq=[("Do the QR codes expire?", "No. The code contains your data directly. It is not a redirect through any service, so it works as long as the link or text itself is valid."),
              ("Is anything tracked or uploaded?", "No. The code is generated in your browser and nothing is sent anywhere, so there are no scan statistics either."),
              ("What does error correction do?", "It lets a QR code still scan when part of it is dirty or covered. Higher levels survive more damage but make the code denser."),
              ("How do I use the Wi-Fi option?", "Enter your network name and password. Most phone cameras offer to join the network when they scan the code. The text is escaped correctly for names and passwords with special characters."),
              ("SVG or PNG?", "SVG stays sharp at any size and is best for printing. PNG is convenient for slides, chats and websites.")]),
    dict(kind="util", group="everyday", slug="password-generator", tool="password-generator", name="Password Generator",
         title="Password Generator: Strong, Random and Private",
         desc="Generate strong random passwords in your browser with a secure random source. Pick length and characters and see the entropy. Nothing is stored.",
         h1="Password <em>generator</em>",
         lede="Create strong random passwords with your browser's cryptographically secure random generator. Choose the length and character types and see how strong the result is. Nothing is sent or stored.",
         short="Strong random passwords with adjustable length, character types and an entropy meter.",
         ui='''%s<div class="meter"><i id="meter"></i></div>%s
<div class="grid2"><div style="display:grid;gap:12px"><label class="fld">Length <span class="rangeval" id="lv">16</span><input type="range" id="len" min="4" max="64" value="16"></label>%s</div>
<div style="display:grid;gap:8px;align-content:start">%s%s%s%s%s</div></div><div class="bar">%s%s</div>''' % (
             ta("out", "Password", True, cls="short"), MSG,
             sel("count", "How many", [("1", "1"), ("5", "5"), ("10", "10")]),
             chk("c-lower", "Lowercase (a-z)", True), chk("c-upper", "Uppercase (A-Z)", True), chk("c-num", "Numbers (0-9)", True), chk("c-sym", "Symbols (!@#...)", True), chk("amb", "Avoid look-alike characters (I, l, 1, O, 0)"),
             btn("gen", "Generate new", True), cp("out", "Copy")),
         steps=["Set the length. 16 characters is a good minimum; use more for important accounts.", "Choose which character types to include.", "Press <strong>Generate new</strong> until you like it, then <strong>Copy</strong> it into your password manager."],
         uses=["Creating a unique password for each account before saving it in a password manager.", "Generating Wi-Fi keys, API secrets and database passwords.", "Making several passwords at once for test accounts.", "Checking how length and character types affect strength."],
         faq=[("Is it safe to generate passwords in a browser?", "Yes, when the generator runs locally and uses crypto.getRandomValues, as this one does. The password is never sent or stored. Save it in a password manager straight away."),
              ("How long should a password be?", "Length matters most. For random passwords, 16 characters or more is strong. Add length rather than complexity rules."),
              ("What is entropy?", "A measure of unpredictability in bits. Each extra bit doubles the guesses an attacker needs. Above about 80 bits is very strong for online accounts."),
              ("Why avoid look-alike characters?", "Characters like I, l, 1, O and 0 are easy to misread. Excluding them helps when you have to type a password by hand.")]),
    dict(kind="util", group="everyday", slug="word-counter", tool="word-counter", name="Word Counter",
         title="Word Counter: Characters, Sentences and Reading Time",
         desc="Count words, characters, sentences and paragraphs, with reading time and top keywords. Free, live and private. Your text never leaves your browser.",
         h1="Word <em>counter</em>",
         lede="Paste or type your text and see words, characters, sentences, paragraphs and estimated reading and speaking time update live, plus the most-used keywords. The text stays in your browser.",
         short="Live word, character, sentence and paragraph counts with reading time and keywords.",
         ui='''%s<div class="bar">%s</div><div class="stats"><div class="stat"><b id="s-words">0</b><span>Words</span></div><div class="stat"><b id="s-chars">0</b><span>Characters</span></div><div class="stat"><b id="s-nosp">0</b><span>No spaces</span></div><div class="stat"><b id="s-sent">0</b><span>Sentences</span></div><div class="stat"><b id="s-para">0</b><span>Paragraphs</span></div><div class="stat"><b id="s-read">0 min</b><span>Reading time</span></div><div class="stat"><b id="s-speak">0 min</b><span>Speaking time</span></div></div>
<div class="fld">Top keywords<ul class="kw" id="kw"></ul></div>''' % (ta("in", "Your text", ph="Start typing or paste your text here"), btn("clear", "Clear")),
         steps=["Type or paste text into the box.", "Read the counts, which update as you type.", "Check the top keywords to see which words you repeat."],
         uses=["Keeping essays, posts and abstracts within a word limit.", "Checking meta descriptions and social posts against character limits.", "Estimating how long an article takes to read or a speech takes to deliver.", "Spotting overused words."],
         faq=[("How are words counted?", "A word is a run of letters or digits, which may include apostrophes and hyphens. This matches how most word processors count, though small differences with other tools are normal."),
              ("How is reading time calculated?", "At about 225 words per minute for silent reading and 130 words per minute for speaking, rounded to whole minutes."),
              ("Does it count characters with spaces?", "Both are shown: total characters including spaces, and characters without spaces."),
              ("Is my text saved?", "No. It is processed live in your browser and is gone when you close the tab.")]),
    dict(kind="util", group="everyday", slug="case-converter", tool="case-converter", name="Case Converter",
         title="Case Converter: UPPER, lower, Title, camelCase and more",
         desc="Convert text to UPPERCASE, lowercase, Title Case, Sentence case, camelCase, snake_case, kebab-case and more. Free, instant and private.",
         h1="Case <em>converter</em>",
         lede="Change the case of any text in one click: upper, lower, title, sentence, camelCase, snake_case, kebab-case and more. Developers can convert variable names line by line.",
         short="Convert text to upper, lower, title, sentence, camel, snake, kebab and more.",
         ui='''<div class="grid2">%s%s</div><div class="casebtns">
<button class="btn btn-ghost" type="button" data-case="upper">UPPERCASE</button><button class="btn btn-ghost" type="button" data-case="lower">lowercase</button><button class="btn btn-ghost" type="button" data-case="title">Title Case</button><button class="btn btn-ghost" type="button" data-case="sentence">Sentence case</button><button class="btn btn-ghost" type="button" data-case="camel">camelCase</button><button class="btn btn-ghost" type="button" data-case="pascal">PascalCase</button><button class="btn btn-ghost" type="button" data-case="snake">snake_case</button><button class="btn btn-ghost" type="button" data-case="kebab">kebab-case</button><button class="btn btn-ghost" type="button" data-case="constant">CONSTANT_CASE</button><button class="btn btn-ghost" type="button" data-case="dot">dot.case</button><button class="btn btn-ghost" type="button" data-case="alt">aLtErNaTiNg</button></div><div class="bar">%s</div>''' % (
             ta("in", "Your text", ph="Type or paste text here"), ta("out", "Converted", True), cp("out", "Copy result")),
         steps=["Type or paste your text into the first box.", "Click a case button. The converted text appears on the right.", "Click <strong>Copy result</strong>. Editing the input keeps the chosen case applied."],
         uses=["Fixing text typed with Caps Lock on.", "Formatting headlines in Title Case.", "Turning phrases into variable, class and file names such as snake_case and kebab-case.", "Normalising lists of names or identifiers."],
         faq=[("How does Title Case work?", "Each word is capitalised except short words such as a, an, the, and, of and in, unless they come first. Style guides differ, so check names and acronyms afterwards."),
              ("What is the difference between camelCase and PascalCase?", "Both join words without separators. camelCase starts with a lowercase letter, PascalCase with an uppercase one."),
              ("Does it convert each line separately?", "For camel, Pascal, snake, kebab, constant and dot case, yes, so you can convert a whole list of names at once."),
              ("Does it work with accented and non-English letters?", "Yes, it uses Unicode-aware letter handling, so accented and many non-Latin scripts convert correctly.")]),
    dict(kind="util", group="everyday", slug="lorem-ipsum-generator", tool="lorem-ipsum", name="Lorem Ipsum Generator",
         title="Lorem Ipsum Generator: Placeholder Text, Instantly",
         desc="Generate lorem ipsum placeholder text by paragraphs, sentences or words, with optional HTML paragraph tags. Free, instant and runs in your browser.",
         h1="Lorem ipsum <em>generator</em>",
         lede="Generate placeholder text for designs and mockups by paragraphs, sentences or words. Start with the classic opening line, wrap paragraphs in HTML tags, and copy the result.",
         short="Placeholder text by paragraphs, sentences or words, with optional HTML tags.",
         ui='''<div class="bar"><label class="fld" style="width:110px">Amount<input type="number" id="count" min="1" max="200" value="3"></label>%s%s%s%s</div>%s<div class="bar">%s</div>''' % (
             sel("unit", "Unit", [("paragraphs", "Paragraphs"), ("sentences", "Sentences"), ("words", "Words")], "auto"), chk("start", "Start with \"Lorem ipsum\"", True), chk("html", "Wrap in &lt;p&gt; tags"), btn("gen", "Generate", True),
             ta("out", "Placeholder text", True), cp("out", "Copy text")),
         steps=["Choose how many paragraphs, sentences or words you need.", "Choose whether to begin with the classic opening and whether to add HTML tags.", "Press <strong>Generate</strong> for a new variation and copy the result."],
         uses=["Filling website and app mockups with realistic-looking text.", "Testing how layouts handle different text lengths.", "Checking typography and line lengths.", "Demo content for templates and themes."],
         faq=[("What is lorem ipsum?", "Scrambled Latin text used as placeholder copy. It looks like real text without distracting readers with meaning."),
              ("Is the text real Latin?", "It is based on words from a classical Latin passage but rearranged randomly, so it does not read as proper Latin."),
              ("Why use it instead of real copy?", "Real copy pulls attention to the words. Placeholder text lets reviewers judge layout and typography."),
              ("Can I use it commercially?", "Yes. It is random filler with no copyright concerns.")]),
]
