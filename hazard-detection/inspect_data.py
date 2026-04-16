import os
import yaml

BASE_DIR = './Environmental_Hazards-1'

def inspect_dataset():
    for split in ['train', 'valid', 'test']:
        img_path = os.path.join(BASE_DIR, split, 'images')
        if os.path.exists(img_path):
            count = len(os.listdir(img_path))
            print(f"{split}: {count} images")
        else:
            print(f"{split}: NOT FOUND")

    yaml_file = os.path.join(BASE_DIR, 'data.yaml')
    if os.path.exists(yaml_file):
        with open(yaml_file, 'r') as f:
            data = yaml.safe_load(f)

        print("\n=== Original data.yaml ===")
        print(yaml.dump(data, default_flow_style=False))
    else:
        print(f"\nConfiguration file not found at: {yaml_file}")

if __name__ == "__main__":
    inspect_dataset()