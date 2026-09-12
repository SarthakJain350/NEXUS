import cv2
import pytesseract


def extract_plate_text(image):
    """
    Extract text from a license plate image using OCR.
    """

    if image is None:
        return {
            "text": "",
            "confidence": 0,
            "status": "invalid_image"
        }

    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)

    text = pytesseract.image_to_string(
        gray,
        config="--psm 7"
    )

    # Clean extracted text
    text = "".join(
        char for char in text.upper()
        if char.isalnum()
    )

    return {
        "text": text,
        "status": "success" if text else "unreadable"
    }
