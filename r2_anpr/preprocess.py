import cv2


def preprocess_plate(image):
    """
    Preprocess a license plate image before OCR.
    """

    # Resize image for better OCR
    image = cv2.resize(
        image,
        None,
        fx=2,
        fy=2,
        interpolation=cv2.INTER_CUBIC
    )

    # Convert to grayscale
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    # Improve contrast using CLAHE
    clahe = cv2.createCLAHE(
        clipLimit=2.0,
        tileGridSize=(8, 8)
    )

    enhanced = clahe.apply(gray)

    # Reduce noise
    denoised = cv2.GaussianBlur(
        enhanced,
        (3, 3),
        0
    )

    return denoised
