from PIL import Image
import sys

def generate_icons(input_path):
    img = Image.open(input_path)
    # Standard Favicon (32x32)
    img.resize((32, 32), Image.Resampling.LANCZOS).save("d:/MIHARI/favicon.png")
    # Apple Touch Icon (180x180)
    img_180 = img.resize((180, 180), Image.Resampling.LANCZOS)
    # Add a background for touch icon if it's transparent, or just save as is
    # Most touch icons look better with a solid background
    bg = Image.new("RGB", (180, 180), (15, 23, 42)) # Match Navy background
    # Calculate position to center the logo
    # Let's give it a bit of padding (80% size)
    icon_size = 140
    icon_resized = img.resize((icon_size, icon_size), Image.Resampling.LANCZOS)
    pos = ((180 - icon_size) // 2, (180 - icon_size) // 2)
    bg.paste(icon_resized, pos, icon_resized)
    bg.save("d:/MIHARI/apple-touch-icon.png")
    print("Icons generated: favicon.png, apple-touch-icon.png")

if __name__ == "__main__":
    generate_icons(sys.argv[1])
