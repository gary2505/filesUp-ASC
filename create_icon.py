from PIL import Image

# Create a simple 32x32 pixel image (blue background)
img = Image.new('RGBA', (32, 32), color=(0, 0, 255, 255))

# Save as ICO
img.save(r'V:\filesUp-ASC\src-tauri\icons\icon.ico', format='ICO')
print('ICO file created successfully')
