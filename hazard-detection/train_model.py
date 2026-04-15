from ultralytics import YOLO

def train_yolo_model():
    model = YOLO('yolo11n.pt')

    results = model.train(
        data="./Environmental_Hazards-1/data.yaml", 
        epochs=100,             
        imgsz=640,             
        batch=16,
        project='./runs', 
        name='hazards_yolo11_focal_2', 
        plots=True,
        cls=1.5,        
        mixup=0.1,         
        copy_paste=0.1,    
        flipud=0.1,        
    )
    
    print("Training successfully initialized/completed.")

if __name__ == "__main__":
    train_yolo_model()