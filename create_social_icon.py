from PIL import Image
import sys

def create_social_icon(logo_path, output_path):
    # Dimensions
    size = 512
    # Background color (Navy: #0F172A)
    bg_color = (15, 23, 42)
    
    # Create background
    icon = Image.new("RGB", (size, size), bg_color)
    
    # Load and resize logo
    logo = Image.open(logo_path).convert("RGBA")
    
    # Calculate resizing to fit with some padding (e.g., 70% of the icon size)
    max_logo_size = int(size * 0.7)
    ratio = min(max_logo_size / logo.width, max_logo_size / logo.height)
    new_w = int(logo.width * ratio)
    new_h = int(logo.height * ratio)
    logo = logo.resize((new_w, new_h), Image.Resampling.LANCZOS)
    
    # Center logo
    pos = ((size - new_w) // 2, (size - new_h) // 2)
    icon.paste(logo, pos, logo)
    
    # Save
    icon.save(output_path, "PNG")
    print(f"Social icon saved to {output_path}")

if __name__ == "__main__":
    create_social_icon(sys.argv[1], sys.argv[2])
