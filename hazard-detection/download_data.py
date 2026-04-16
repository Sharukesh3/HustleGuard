import os
from roboflow import Roboflow

def download_dataset():
    rf = Roboflow(api_key="your own roboflow private key")
    project = rf.workspace("lumen-visual-assistant").project("environmental_hazards-vnsbh")
    version = project.version(1)

    dataset = version.download("yolov11") # download for your desired yolo version - for me v11

    print(f"Dataset securely downloaded to: {os.path.abspath(dataset.location)}")

if __name__ == "__main__":
    download_dataset()