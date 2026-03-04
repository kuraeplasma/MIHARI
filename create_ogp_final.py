from PIL import Image, ImageDraw, ImageFont
import os

def create_ogp():
    # Settings
    width, height = 1200, 630
    bg_color = (15, 23, 42) # #0F172A
    text_color = (255, 255, 255) # White
    emerald_color = (16, 185, 129) # #10B981
    
    # Create canvas
    img = Image.new("RGB", (width, height), bg_color)
    draw = ImageDraw.Draw(img)
    
    # Font paths
    font_bold_path = "C:/Windows/Fonts/YuGothB.ttc"
    # Fallback to msgothic if YuGothB is missing
    if not os.path.exists(font_bold_path):
        font_bold_path = "C:/Windows/Fonts/msgothic.ttc"

    # Load logo
    logo_path = "d:/MIHARI/logo_transparent.png"
    logo = Image.open(logo_path).convert("RGBA")
    
    # Resize logo to be fairly prominent (e.g., 100px height)
    logo_h = 140
    logo_w = int(logo.width * (logo_h / logo.height))
    logo = logo.resize((logo_w, logo_h), Image.Resampling.LANCZOS)
    
    # Load fonts
    font_brand = ImageFont.truetype(font_bold_path, 100) # MIHARI
    font_tagline = ImageFont.truetype(font_bold_path, 40) # Tagline
    
    # Calculate sizes
    brand_text = "MIHARI"
    tagline_text = "Webの不具合は、静かに売上を削ります"
    
    # Using font.getbbox for modern Pillow
    brand_bbox = font_brand.getbbox(brand_text)
    brand_w = brand_bbox[2] - brand_bbox[0]
    brand_h = brand_bbox[3] - brand_bbox[1]
    
    tagline_bbox = font_tagline.getbbox(tagline_text)
    tagline_w = tagline_bbox[2] - tagline_bbox[0]
    
    # Calculate branding group (Logo + Text)
    gap = 30
    total_branding_w = logo_w + gap + brand_w
    
    # Center branding group
    start_x = (width - total_branding_w) // 2
    logo_y = (height - logo_h) // 2 - 40 # Offset upwards slightly
    
    # Paste logo
    img.paste(logo, (start_x, logo_y), logo)
    
    # Draw "MIHARI"
    # Align text vertically with logo center
    text_y = logo_y + (logo_h - brand_h) // 2 - brand_bbox[1] 
    draw.text((start_x + logo_w + gap, text_y), brand_text, font=font_brand, fill=emerald_color)
    
    # Draw tagline
    tagline_y = logo_y + logo_h + 60
    draw.text(((width - tagline_w) // 2, tagline_y), tagline_text, font=font_tagline, fill=text_color)
    
    # Add a thin bottom border or subtle accent
    draw.rectangle([0, height-8, width, height], fill=emerald_color)
    
    # Save
    img.save("d:/MIHARI/ogp_image.png")
    print("OGP image recreated successfully.")

if __name__ == "__main__":
    create_ogp()
