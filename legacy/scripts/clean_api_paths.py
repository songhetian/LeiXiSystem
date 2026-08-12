import os
import re

def clean_api_paths(directory):
    patterns = [
        (re.compile(r"api\.(get|post|put|delete|patch)\((['\"])/api/"), r"api.\1(\2/"),
        (re.compile(r"api\((['\"])/api/"), r"api(\1/"),
        (re.compile(r"getApiUrl\((['\"])/api/"), r"getApiUrl(\1/")
    ]

    for root, dirs, files in os.walk(directory):
        for file in files:
            if file.endswith(('.js', '.jsx')):
                file_path = os.path.join(root, file)
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        content = f.read()
                    
                    new_content = content
                    for pattern, replacement in patterns:
                        new_content = pattern.sub(replacement, new_content)
                    
                    if new_content != content:
                        with open(file_path, 'w', encoding='utf-8') as f:
                            f.write(new_content)
                        print(f"Updated: {file_path}")
                except Exception as e:
                    print(f"Error processing {file_path}: {e}")

if __name__ == "__main__":
    clean_api_paths('src')
