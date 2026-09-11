import re


def clean_plate_text(text):
    """
    Clean and normalize OCR output for a license plate.
    """

    if not text:
        return ""

    # Convert to uppercase
    text = text.upper()

    # Remove spaces and special characters
    text = re.sub(r"[^A-Z0-9]", "", text)

    return text
