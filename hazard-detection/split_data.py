import os
import random
import shutil
import yaml

BASE_DIR = './Environmental_Hazards-1'

def process_and_split_data():
    train_img_dir = os.path.join(BASE_DIR, 'train', 'images')
    train_lbl_dir = os.path.join(BASE_DIR, 'train', 'labels')
    val_img_dir   = os.path.join(BASE_DIR, 'valid', 'images')
    val_lbl_dir   = os.path.join(BASE_DIR, 'valid', 'labels')
    test_img_dir  = os.path.join(BASE_DIR, 'test', 'images')
    test_lbl_dir  = os.path.join(BASE_DIR, 'test', 'labels')

    os.makedirs(val_img_dir, exist_ok=True)
    os.makedirs(val_lbl_dir, exist_ok=True)
    os.makedirs(test_img_dir, exist_ok=True)
    os.makedirs(test_lbl_dir, exist_ok=True)

    val_count = len(os.listdir(val_img_dir)) if os.path.exists(val_img_dir) else 0

    if val_count < 5:
        images = [f for f in os.listdir(train_img_dir) if f.lower().endswith(('.jpg', '.jpeg', '.png'))]
        random.seed(42)
        random.shuffle(images)

        val_size  = int(len(images) * 0.15)
        test_size = int(len(images) * 0.05)

        val_images  = images[:val_size]
        test_images = images[val_size:val_size + test_size]

        def move_split(file_list, src_img, src_lbl, dst_img, dst_lbl):
            for img_name in file_list:
                shutil.move(os.path.join(src_img, img_name), os.path.join(dst_img, img_name))
                base = os.path.splitext(img_name)[0]
                lbl = base + '.txt'
                if os.path.exists(os.path.join(src_lbl, lbl)):
                    shutil.move(os.path.join(src_lbl, lbl), os.path.join(dst_lbl, lbl))

        move_split(val_images,  train_img_dir, train_lbl_dir, val_img_dir,  val_lbl_dir)
        move_split(test_images, train_img_dir, train_lbl_dir, test_img_dir, test_lbl_dir)

        print(f"Moved {val_size} images -> val")
        print(f"Moved {test_size} images -> test")
        print(f"Remaining train images: {len(os.listdir(train_img_dir))}")
    else:
        print(f"Val already has {val_count} images — skipping split.")

    yaml_file = os.path.join(BASE_DIR, 'data.yaml')
    if os.path.exists(yaml_file):
        with open(yaml_file, 'r') as f:
            data = yaml.safe_load(f)

        data['train'] = f"{BASE_DIR}/train/images"
        data['val']   = f"{BASE_DIR}/valid/images"
        data['test']  = f"{BASE_DIR}/test/images"

        with open(yaml_file, 'w') as f:
            yaml.dump(data, f, sort_keys=False)

        print("\n=== Updated data.yaml ===")
        with open(yaml_file) as f:
            print(f.read())
    else:
        print(f"\n{yaml_file} not found. Cannot update YAML paths.")

if __name__ == "__main__":
    process_and_split_data()