#!/usr/bin/env python3
"""
Skrypt tworzący schemat JSON projektu Next.js z analizą struktury funkcji
Umieść ten skrypt w folderze ignore_py_files
"""

import os
import re
import json
import sys
from pathlib import Path
from datetime import datetime

# Rozszerzenia plików do analizy
ANALYZABLE_EXTENSIONS = {
    '.js', '.jsx', '.ts', '.tsx', '.css', '.scss', '.sass',
    '.json', '.md', '.mdx', '.html', '.yml', '.yaml'
}

# Foldery do pominięcia
IGNORE_DIRS = {
    'node_modules', '.next', '.git', 'dist', 'build',
    'coverage', '.nyc_output', 'ignore_py_files', '.vscode'
}

# Pliki do pominięcia
IGNORE_FILES = {
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml'
}


class ProjectAnalyzer:
    def __init__(self):
        self.schema = {
            "project_info": {},
            "directory_structure": {},
            "file_analysis": {},
            "statistics": {}
        }

    def analyze_js_ts_file(self, file_path):
        """Analizuje pliki JS/TS/JSX/TSX"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            analysis = {
                "type": "javascript/typescript",
                "functions": [],
                "components": [],
                "exports": [],
                "imports": [],
                "hooks": [],
                "classes": []
            }

            # Znajdź importy
            import_pattern = r'import\s+(?:{[^}]+}|\w+|\*\s+as\s+\w+)\s+from\s+[\'"]([^\'"]+)[\'"]'
            imports = re.findall(import_pattern, content)
            analysis["imports"] = imports[:10]  # Ograniczenie dla krótkości

            # Znajdź funkcje
            function_patterns = [
                r'function\s+(\w+)\s*\(',
                r'const\s+(\w+)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>\s*{|\([^)]*\)\s*=>\s*[^{])',
                r'(\w+)\s*:\s*(?:async\s+)?\([^)]*\)\s*=>\s*{?',
                r'async\s+function\s+(\w+)\s*\('
            ]

            for pattern in function_patterns:
                matches = re.findall(pattern, content, re.MULTILINE)
                analysis["functions"].extend(matches)

            # Znajdź komponenty React
            component_patterns = [
                r'(?:export\s+(?:default\s+)?)?(?:const\s+|function\s+)(\w+)(?:\s*[=:]?\s*(?:\([^)]*\)\s*=>\s*{|\([^)]*\)\s*=>\s*<|\([^)]*\)\s*{))',
                r'class\s+(\w+)\s+extends\s+(?:React\.)?Component'
            ]

            for pattern in component_patterns:
                matches = re.findall(pattern, content)
                for match in matches:
                    if match[0].isupper():  # Komponenty React zaczynają się wielką literą
                        analysis["components"].append(match)

            # Znajdź hooki
            hook_pattern = r'use(\w+)\s*\('
            hooks = re.findall(hook_pattern, content)
            analysis["hooks"] = list(set(hooks))

            # Znajdź eksporty
            export_patterns = [
                r'export\s+(?:default\s+)?(?:const\s+|function\s+|class\s+)?(\w+)',
                r'export\s+{\s*([^}]+)\s*}',
                r'export\s*\*\s*from\s+[\'"]([^\'"]+)[\'"]'
            ]

            for pattern in export_patterns:
                matches = re.findall(pattern, content)
                analysis["exports"].extend([m for m in matches if m])

            # Usuń duplikaty
            analysis["functions"] = list(set(analysis["functions"]))
            analysis["components"] = list(set(analysis["components"]))
            analysis["exports"] = list(set(analysis["exports"]))
            analysis["hooks"] = list(set(analysis["hooks"]))

            # Dodaj podstawowe statystyki
            analysis["lines_count"] = len(content.splitlines())
            analysis["size_kb"] = round(len(content.encode('utf-8')) / 1024, 2)

            return analysis

        except Exception as e:
            return {"type": "javascript/typescript", "error": str(e)}

    def analyze_css_file(self, file_path):
        """Analizuje pliki CSS/SCSS"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            analysis = {
                "type": "stylesheet",
                "classes": [],
                "ids": [],
                "variables": [],
                "imports": []
            }

            # Znajdź klasy CSS
            class_pattern = r'\.([a-zA-Z_-][a-zA-Z0-9_-]*)\s*{'
            classes = re.findall(class_pattern, content)
            analysis["classes"] = list(set(classes))[:20]  # Ograniczenie

            # Znajdź ID
            id_pattern = r'#([a-zA-Z_-][a-zA-Z0-9_-]*)\s*{'
            ids = re.findall(id_pattern, content)
            analysis["ids"] = list(set(ids))

            # Znajdź zmienne CSS/SCSS
            var_patterns = [
                r'--([a-zA-Z_-][a-zA-Z0-9_-]*)\s*:',  # CSS custom properties
                r'\$([a-zA-Z_-][a-zA-Z0-9_-]*)\s*:'  # SCSS variables
            ]

            for pattern in var_patterns:
                variables = re.findall(pattern, content)
                analysis["variables"].extend(variables)

            # Znajdź importy
            import_pattern = r'@import\s+[\'"]([^\'"]+)[\'"]'
            imports = re.findall(import_pattern, content)
            analysis["imports"] = imports

            analysis["lines_count"] = len(content.splitlines())
            analysis["size_kb"] = round(len(content.encode('utf-8')) / 1024, 2)

            return analysis

        except Exception as e:
            return {"type": "stylesheet", "error": str(e)}

    def analyze_json_file(self, file_path):
        """Analizuje pliki JSON"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()
                data = json.loads(content)

            analysis = {
                "type": "json",
                "keys": list(data.keys()) if isinstance(data, dict) else [],
                "structure": type(data).__name__
            }

            # Dla package.json dodaj specjalne info
            if file_path.name == 'package.json':
                analysis["package_info"] = {
                    "name": data.get("name"),
                    "version": data.get("version"),
                    "dependencies_count": len(data.get("dependencies", {})),
                    "dev_dependencies_count": len(data.get("devDependencies", {})),
                    "scripts": list(data.get("scripts", {}).keys())
                }

            analysis["size_kb"] = round(len(content.encode('utf-8')) / 1024, 2)
            return analysis

        except Exception as e:
            return {"type": "json", "error": str(e)}

    def analyze_markdown_file(self, file_path):
        """Analizuje pliki Markdown"""
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            analysis = {
                "type": "markdown",
                "headings": [],
                "links": []
            }

            # Znajdź nagłówki
            heading_pattern = r'^(#{1,6})\s+(.+)$'
            headings = re.findall(heading_pattern, content, re.MULTILINE)
            analysis["headings"] = [(len(h[0]), h[1]) for h in headings]

            # Znajdź linki
            link_pattern = r'\[([^\]]+)\]\(([^)]+)\)'
            links = re.findall(link_pattern, content)
            analysis["links"] = links[:10]  # Ograniczenie

            analysis["lines_count"] = len(content.splitlines())
            analysis["size_kb"] = round(len(content.encode('utf-8')) / 1024, 2)

            return analysis

        except Exception as e:
            return {"type": "markdown", "error": str(e)}

    def analyze_file(self, file_path):
        """Analizuje pojedynczy plik"""
        ext = file_path.suffix.lower()

        if ext in ['.js', '.jsx', '.ts', '.tsx']:
            return self.analyze_js_ts_file(file_path)
        elif ext in ['.css', '.scss', '.sass']:
            return self.analyze_css_file(file_path)
        elif ext == '.json':
            return self.analyze_json_file(file_path)
        elif ext in ['.md', '.mdx']:
            return self.analyze_markdown_file(file_path)
        else:
            # Podstawowa analiza dla innych plików
            try:
                with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                    content = f.read()
                return {
                    "type": "other",
                    "lines_count": len(content.splitlines()),
                    "size_kb": round(len(content.encode('utf-8')) / 1024, 2)
                }
            except:
                return {"type": "binary", "size_kb": round(file_path.stat().st_size / 1024, 2)}

    def should_analyze_file(self, file_path):
        """Sprawdza czy plik powinien być analizowany"""
        if file_path.name in IGNORE_FILES:
            return False
        if file_path.suffix.lower() not in ANALYZABLE_EXTENSIONS:
            return False
        return True

    def build_directory_tree(self, path, project_root):
        """Buduje drzewo katalogów"""
        tree = {}
        relative_path = path.relative_to(project_root)

        if path.is_file():
            return {
                "type": "file",
                "name": path.name,
                "extension": path.suffix,
                "size_kb": round(path.stat().st_size / 1024, 2) if path.exists() else 0
            }

        tree = {
            "type": "directory",
            "name": path.name,
            "children": {}
        }

        try:
            for child in sorted(path.iterdir()):
                # Pomijaj ukryte pliki i ignorowane foldery
                if child.name.startswith('.') and child.name not in ['.env.example', '.gitignore']:
                    continue
                if child.name in IGNORE_DIRS:
                    continue

                tree["children"][child.name] = self.build_directory_tree(child, project_root)
        except PermissionError:
            pass

        return tree

    def find_project_root(self):
        """Znajduje główny folder projektu"""
        current_path = Path(__file__).parent
        while current_path.parent != current_path:
            current_path = current_path.parent
            if (current_path / 'package.json').exists():
                return current_path
        return Path(__file__).parent.parent

    def analyze_project(self):
        """Główna metoda analizy projektu"""
        project_root = self.find_project_root()
        print(f"🔍 Analizuję projekt: {project_root}")

        # Informacje o projekcie
        self.schema["project_info"] = {
            "project_path": str(project_root),
            "analyzed_at": datetime.now().isoformat(),
            "analyzer_version": "1.0"
        }

        # Pobierz info z package.json jeśli istnieje
        package_json_path = project_root / 'package.json'
        if package_json_path.exists():
            try:
                with open(package_json_path, 'r', encoding='utf-8') as f:
                    package_data = json.load(f)
                self.schema["project_info"]["package_name"] = package_data.get("name")
                self.schema["project_info"]["package_version"] = package_data.get("version")
            except:
                pass

        # Buduj strukturę katalogów
        print("📁 Budowanie struktury katalogów...")
        self.schema["directory_structure"] = self.build_directory_tree(project_root, project_root)

        # Analizuj pliki
        print("📝 Analizowanie plików...")
        file_count = 0
        error_count = 0

        for file_path in project_root.rglob('*'):
            if file_path.is_file():
                # Pomijaj pliki w ignorowanych folderach
                if any(ignored_dir in file_path.parts for ignored_dir in IGNORE_DIRS):
                    continue

                if self.should_analyze_file(file_path):
                    relative_path = str(file_path.relative_to(project_root))
                    analysis = self.analyze_file(file_path)

                    if "error" in analysis:
                        error_count += 1
                        print(f"⚠️  Błąd analizy: {relative_path}")
                    else:
                        file_count += 1
                        if file_count % 10 == 0:
                            print(f"   📄 Przeanalizowano {file_count} plików...")

                    self.schema["file_analysis"][relative_path] = analysis

        # Statystyki
        total_files = len(self.schema["file_analysis"])
        js_ts_files = sum(1 for a in self.schema["file_analysis"].values()
                          if a.get("type") == "javascript/typescript")
        css_files = sum(1 for a in self.schema["file_analysis"].values()
                        if a.get("type") == "stylesheet")

        self.schema["statistics"] = {
            "total_analyzed_files": total_files,
            "successful_analyses": file_count,
            "errors": error_count,
            "file_types": {
                "javascript_typescript": js_ts_files,
                "stylesheets": css_files,
                "json": sum(1 for a in self.schema["file_analysis"].values() if a.get("type") == "json"),
                "markdown": sum(1 for a in self.schema["file_analysis"].values() if a.get("type") == "markdown"),
                "other": sum(1 for a in self.schema["file_analysis"].values() if a.get("type") == "other")
            }
        }

        print(f"✅ Analiza zakończona: {file_count} plików, {error_count} błędów")

    def save_schema(self, output_file="project_schema.json"):
        """Zapisuje schemat do pliku JSON"""
        output_path = Path(__file__).parent / output_file

        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.schema, f, indent=2, ensure_ascii=False, sort_keys=True)

        print(f"💾 Schemat zapisany do: {output_path}")
        print(f"📊 Rozmiar pliku: {round(output_path.stat().st_size / 1024, 2)} KB")


def main():
    """Główna funkcja"""
    print("🚀 Tworzenie schematu projektu Next.js...")

    analyzer = ProjectAnalyzer()
    analyzer.analyze_project()
    analyzer.save_schema()

    print("\n🎉 Gotowe! Sprawdź plik project_schema.json")


if __name__ == "__main__":
    main()