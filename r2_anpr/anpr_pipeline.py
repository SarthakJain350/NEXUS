from preprocess import preprocess_plate
from plate_cleaner import clean_plate
from ocr_engine import extract_plate_text
from confidence_handler import calculate_confidence, get_plate_status


def process_plate(image):
    """
    Complete R2 ANPR and OCR enhancement pipeline.
    """

    # Step 1: Preprocess image
    processed_image = preprocess_plate(image)

    # Step 2: Extract text using OCR
    ocr_result = extract_plate_text(processed_image)

    raw_text = ocr_result.get("text", "")

    # Step 3: Clean the detected plate text
    clean_text = clean_plate(raw_text)

    # Step 4: Calculate confidence
    confidence = calculate_confidence(clean_text)

    # Step 5: Get readability status
    status = get_plate_status(confidence)

    return {
        "plate_text": clean_text,
        "confidence": confidence,
        "status": status
    }
