def calculate_confidence(text):
    """
    Calculate a simple confidence score for
    the detected license plate text.
    """

    if not text:
        return 0

    score = 50

    # Valid license plates generally contain
    # letters and numbers
    if text.isalnum():
        score += 20

    # Typical plate length check
    if 6 <= len(text) <= 12:
        score += 20

    # Contains both letters and numbers
    has_letter = any(char.isalpha() for char in text)
    has_number = any(char.isdigit() for char in text)

    if has_letter and has_number:
        score += 10

    return min(score, 100)


def get_plate_status(confidence):
    """
    Return readability status based on confidence.
    """

    if confidence >= 80:
        return "readable"
    elif confidence >= 50:
        return "low_confidence"
    else:
        return "unreadable"
