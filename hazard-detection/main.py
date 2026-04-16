from download_data import download_dataset
from inspect_data import inspect_dataset
from split_data import process_and_split_data
from train_model import train_yolo_model

def main():
    print("1. Downloading Dataset")
    download_dataset()

    print("\n 2. Inspecting Initial Data ")
    inspect_dataset()

    print("\n 3. Processing and Splitting Data")
    process_and_split_data()

    print("\n4. Training YOLO Model ")
    train_yolo_model()

if __name__ == "__main__":
    main()