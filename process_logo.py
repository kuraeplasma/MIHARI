import sys
from PIL import Image, ImageChops

def process_logo(input_path, output_path):
    # Open the image
    img = Image.open(input_path).convert("RGBA")
    datas = img.getdata()

    # Create new data with transparency
    new_data = []
    for item in datas:
        # If the pixel is very dark (background-like), make it transparent
        # Using a threshold for dark colors since it's not pure black
        if item[0] < 50 and item[1] < 50 and item[2] < 70:
            new_data.append((0, 0, 0, 0))
        else:
            new_data.append(item)

    img.putdata(new_data)

    # Crop the image to the bounding box of non-transparent pixels (trimMING)
    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    # Save the result
    img.save(output_path, "PNG")
    print(f"Processed image saved to {output_path}")

if __name__ == "__main__":
    process_logo(sys.argv[1], sys.argv[2])
