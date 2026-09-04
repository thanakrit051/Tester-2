# สร้างไอคอน PNG ของ AssignCheck จาก geometry เดียวกับ icons/icon.svg
# วาดด้วยเส้น (path) ล้วน ไม่ใช้ฟอนต์ ผลจึงตรงกับ SVG เป๊ะ
Add-Type -AssemblyName System.Drawing

# ไม่ใส่พารามิเตอร์ = เขียนลงโฟลเดอร์ icons/ ของโปรเจกต์
if ($args.Count -ge 1) { $out = $args[0] } else { $out = Join-Path (Split-Path -Parent $PSScriptRoot) "icons" }
if (-not (Test-Path $out)) { New-Item -ItemType Directory -Path $out | Out-Null }
$lime = [System.Drawing.Color]::FromArgb(255, 199, 240, 74)   # #c7f04a
$ink  = [System.Drawing.Color]::FromArgb(255, 11, 43, 36)     # #0b2b24
$bar  = [System.Drawing.Color]::FromArgb(255, 11, 43, 36)

function New-RoundRect([single]$x, [single]$y, [single]$w, [single]$h, [single]$r) {
  $p = New-Object System.Drawing.Drawing2D.GraphicsPath
  $d = [single]($r * 2)
  $p.AddArc($x,          $y,          $d, $d, 180, 90)
  $p.AddArc($x + $w - $d, $y,          $d, $d, 270, 90)
  $p.AddArc($x + $w - $d, $y + $h - $d, $d, $d,   0, 90)
  $p.AddArc($x,          $y + $h - $d, $d, $d,  90, 90)
  $p.CloseFigure()
  return $p
}

# วาดตัว A ในระบบพิกัด 0..100 (ต้องตั้ง transform มาก่อน)
function Draw-Mark($g, $color) {
  $pen = New-Object System.Drawing.Pen($color, [single]12)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap   = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round
  $legs = New-Object System.Drawing.Drawing2D.GraphicsPath
  $legs.AddLines(@(
    (New-Object System.Drawing.PointF([single]21, [single]78)),
    (New-Object System.Drawing.PointF([single]50, [single]22)),
    (New-Object System.Drawing.PointF([single]79, [single]78))
  ))
  $g.DrawPath($pen, $legs)
  $g.DrawLine($pen, [single]30.84, [single]59, [single]68.16, [single]59)
  $legs.Dispose(); $pen.Dispose()
}

function New-Icon([int]$size, [double]$markScale, [bool]$rounded, [string]$file) {
  $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.Clear([System.Drawing.Color]::Transparent)

  $brush = New-Object System.Drawing.SolidBrush($lime)
  if ($rounded) {
    $tile = New-RoundRect 0 0 ([single]$size) ([single]$size) ([single]($size * 0.22))
    $g.FillPath($brush, $tile)
    $tile.Dispose()
  } else {
    $g.FillRectangle($brush, 0, 0, $size, $size)
  }
  $brush.Dispose()

  $s = [single](($size / 100.0) * $markScale)
  $g.TranslateTransform([single]($size / 2.0), [single]($size / 2.0))
  $g.ScaleTransform($s, $s)
  $g.TranslateTransform([single](-50), [single](-50))
  Draw-Mark $g $ink
  $g.ResetTransform()

  $bmp.Save((Join-Path $out $file), [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
  Write-Output ("  " + $file + "  " + $size + "x" + $size)
}

# ── ไอคอนทุกขนาด ──────────────────────────────────────────
# markScale 1.0 = ตัว A กว้าง 70% ของกรอบ (สัดส่วนมาตรฐานของ app icon)
# maskable ต้องอยู่ในวงกลมปลอดภัย 80% จึงย่อเหลือ 0.78 และเต็มกรอบไม่มนมุม
New-Icon 512 1.0  $true  "icon-512.png"
New-Icon 192 1.0  $true  "icon-192.png"
New-Icon 512 0.78 $false "icon-512-maskable.png"
New-Icon 192 0.78 $false "icon-192-maskable.png"
New-Icon 180 1.0  $false "apple-touch-icon.png"   # iOS ใส่มุมมนเองและไม่รองรับพื้นโปร่ง
New-Icon  48 1.0  $true  "favicon-48.png"
New-Icon  32 1.0  $true  "favicon-32.png"
New-Icon  16 1.0  $true  "favicon-16.png"

# ── ภาพตอนแชร์ลิงก์ (og:image) ────────────────────────────
$w = 1200; $h = 630
$bmp = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode   = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$bg = New-Object System.Drawing.SolidBrush($bar)
$g.FillRectangle($bg, 0, 0, $w, $h); $bg.Dispose()

$tileSize = 190
$tileX = 104; $tileY = [int](($h - $tileSize) / 2)
$brush = New-Object System.Drawing.SolidBrush($lime)
$tile = New-RoundRect ([single]$tileX) ([single]$tileY) ([single]$tileSize) ([single]$tileSize) ([single]($tileSize * 0.22))
$g.FillPath($brush, $tile); $tile.Dispose(); $brush.Dispose()

$s = [single]($tileSize / 100.0)
$g.TranslateTransform([single]($tileX + $tileSize / 2.0), [single]($tileY + $tileSize / 2.0))
$g.ScaleTransform($s, $s)
$g.TranslateTransform([single](-50), [single](-50))
Draw-Mark $g $ink
$g.ResetTransform()

$fTitle = New-Object System.Drawing.Font("Segoe UI", 70, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$fSub   = New-Object System.Drawing.Font("Leelawadee UI", 33, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$white  = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$muted  = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 169, 198, 189))
$limeBr = New-Object System.Drawing.SolidBrush($lime)

$tx = [single]($tileX + $tileSize + 50)
$g.DrawString("AssignCheck", $fTitle, $white, $tx, [single]224)
$g.DrawString("เช็คชื่อ · เช็คงาน · สรุปคะแนน SGS", $fSub, $muted, $tx, [single]326)
$g.DrawString("สำหรับครู · ข้อมูลอยู่ในชีตของคุณเอง", $fSub, $limeBr, $tx, [single]376)

$fTitle.Dispose(); $fSub.Dispose(); $white.Dispose(); $muted.Dispose(); $limeBr.Dispose()
$bmp.Save((Join-Path $out "og-image.png"), [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "  og-image.png  1200x630"

# ── รวม 16/32/48 เป็น favicon.ico (ไฟล์เดียว เบราว์เซอร์เก่ารองรับ) ──
# ICO ที่บรรจุ PNG ข้างใน รองรับตั้งแต่ IE11 ขึ้นไปและเบราว์เซอร์ปัจจุบันทุกตัว
$sizes = @(16, 32, 48)
$blobs = @()
foreach ($sz in $sizes) {
  $blobs += ,([System.IO.File]::ReadAllBytes((Join-Path $out ("favicon-" + $sz + ".png"))))
}
$ms = New-Object System.IO.MemoryStream
$bw = New-Object System.IO.BinaryWriter($ms)
$bw.Write([UInt16]0)            # reserved
$bw.Write([UInt16]1)            # type = icon
$bw.Write([UInt16]$sizes.Count)
$offset = 6 + 16 * $sizes.Count
for ($i = 0; $i -lt $sizes.Count; $i++) {
  $bw.Write([byte]$sizes[$i])   # กว้าง
  $bw.Write([byte]$sizes[$i])   # สูง
  $bw.Write([byte]0)            # จำนวนสีในพาเลต (0 = ไม่ใช้พาเลต)
  $bw.Write([byte]0)            # reserved
  $bw.Write([UInt16]1)          # color planes
  $bw.Write([UInt16]32)         # bits per pixel
  $bw.Write([UInt32]$blobs[$i].Length)
  $bw.Write([UInt32]$offset)
  $offset += $blobs[$i].Length
}
foreach ($b in $blobs) { $bw.Write($b) }
$bw.Flush()
[System.IO.File]::WriteAllBytes((Join-Path $out "favicon.ico"), $ms.ToArray())
$bw.Dispose(); $ms.Dispose()
Write-Output ("  favicon.ico   16+32+48")
