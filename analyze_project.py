import os
import json
from pathlib import Path
from datetime import datetime


class ProjectAnalyzer:
    def __init__(self, base_path="."):
        self.base_path = Path(base_path)
        self.report = {
            "data_analizy": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "nazwa_projektu": self.base_path.name,
            "struktura": {},
            "technologie": [],
            "routing": [],
            "komponenty": [],
            "api_endpoints": [],
            "pliki_config": {},
            "statystyki": {}
        }
        self.ignore_dirs = {'.git', '.next', 'node_modules', '.idea', '__pycache__', 'dist', 'build'}
        self.stats = {'files': 0, 'dirs': 0, 'tsx': 0, 'ts': 0, 'css': 0, 'json': 0}

    def scan_directory(self, path, level=0, max_level=6):
        if level > max_level:
            return {}

        structure = {}
        try:
            items = sorted(path.iterdir())
            for item in items:
                if item.name.startswith('.') and item.name not in ['.env', '.env.example', '.env.local']:
                    continue
                if item.name in self.ignore_dirs:
                    continue

                if item.is_dir():
                    self.stats['dirs'] += 1
                    structure[item.name] = {
                        "typ": "folder",
                        "zawartosc": self.scan_directory(item, level + 1, max_level)
                    }
                else:
                    self.stats['files'] += 1
                    ext = item.suffix.lower()

                    if ext == '.tsx':
                        self.stats['tsx'] += 1
                    elif ext == '.ts':
                        self.stats['ts'] += 1
                    elif ext == '.css':
                        self.stats['css'] += 1
                    elif ext == '.json':
                        self.stats['json'] += 1

                    structure[item.name] = {
                        "typ": "file",
                        "ext": ext,
                        "size": item.stat().st_size
                    }
        except PermissionError:
            pass

        return structure

    def detect_technologies(self):
        techs = []

        package_json = self.base_path / "package.json"
        if package_json.exists():
            try:
                with open(package_json, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    deps = {**data.get('dependencies', {}), **data.get('devDependencies', {})}

                    if 'next' in deps:
                        techs.append(f"Next.js {deps['next']}")
                    if 'react' in deps:
                        techs.append(f"React {deps['react']}")
                    if 'typescript' in deps:
                        techs.append("TypeScript")
                    if '@prisma/client' in deps or 'prisma' in deps:
                        techs.append("Prisma ORM")
                    if 'tailwindcss' in deps:
                        techs.append("Tailwind CSS")
                    if '@shadcn/ui' in deps or '@radix-ui/react' in deps:
                        techs.append("shadcn/ui")

                    self.report['pliki_config']['package.json'] = data
            except:
                pass

        tsconfig = self.base_path / "tsconfig.json"
        if tsconfig.exists():
            try:
                with open(tsconfig, 'r', encoding='utf-8') as f:
                    self.report['pliki_config']['tsconfig.json'] = json.load(f)
            except:
                pass

        if (self.base_path / "prisma").exists():
            techs.append("Prisma Schema")
            schema_file = self.base_path / "prisma" / "schema.prisma"
            if schema_file.exists():
                try:
                    with open(schema_file, 'r', encoding='utf-8') as f:
                        self.report['pliki_config']['prisma_schema'] = f.read()
                except:
                    pass

        if (self.base_path / "src" / "app").exists():
            techs.append("Next.js App Router")
        elif (self.base_path / "pages").exists():
            techs.append("Next.js Pages Router")

        return techs

    def analyze_routing(self):
        routes = []
        app_dir = self.base_path / "src" / "app"
        if not app_dir.exists():
            app_dir = self.base_path / "app"

        if app_dir.exists():
            routes.extend(self._scan_app_router(app_dir, ""))

        return routes

    def _scan_app_router(self, path, route):
        routes = []

        try:
            for item in path.iterdir():
                if item.name.startswith('.') or item.name in self.ignore_dirs:
                    continue

                if item.is_dir():
                    folder_name = item.name

                    if folder_name.startswith('(') and folder_name.endswith(')'):
                        new_route = route
                        route_type = "route_group"
                    else:
                        new_route = f"{route}/{folder_name}"
                        route_type = "route"

                    has_page = (item / "page.tsx").exists() or (item / "page.ts").exists()
                    has_layout = (item / "layout.tsx").exists() or (item / "layout.ts").exists()
                    has_route = (item / "route.ts").exists()

                    if has_page or has_layout or has_route or route_type == "route_group":
                        routes.append({
                            "sciezka": new_route if new_route else "/",
                            "folder": folder_name,
                            "typ": route_type,
                            "ma_page": has_page,
                            "ma_layout": has_layout,
                            "ma_route": has_route
                        })

                    routes.extend(self._scan_app_router(item, new_route))
        except PermissionError:
            pass

        return routes

    def find_components(self):
        components = []
        components_dir = self.base_path / "src" / "components"
        if not components_dir.exists():
            components_dir = self.base_path / "components"

        if components_dir.exists():
            components.extend(self._scan_components(components_dir, ""))

        app_components_dir = self.base_path / "src" / "app" / "components"
        if app_components_dir.exists():
            components.extend(self._scan_components(app_components_dir, "app/"))

        return components

    def _scan_components(self, path, prefix):
        components = []

        try:
            for item in path.iterdir():
                if item.name.startswith('.'):
                    continue

                if item.is_file() and (item.suffix == '.tsx' or item.suffix == '.jsx'):
                    components.append({
                        "nazwa": item.name,
                        "sciezka": f"{prefix}{item.name}",
                        "typ": item.suffix
                    })
                elif item.is_dir():
                    components.extend(self._scan_components(item, f"{prefix}{item.name}/"))
        except PermissionError:
            pass

        return components

    def find_api_endpoints(self):
        endpoints = []
        api_dir = self.base_path / "src" / "app" / "api"
        if not api_dir.exists():
            api_dir = self.base_path / "app" / "api"

        if api_dir.exists():
            endpoints.extend(self._scan_api(api_dir, "/api"))

        return endpoints

    def _scan_api(self, path, route):
        endpoints = []

        try:
            for item in path.iterdir():
                if item.name.startswith('.') or item.name in self.ignore_dirs:
                    continue

                if item.is_dir():
                    new_route = f"{route}/{item.name}"

                    has_route = (item / "route.ts").exists() or (item / "route.tsx").exists()

                    if has_route:
                        route_file = item / "route.ts" if (item / "route.ts").exists() else item / "route.tsx"
                        methods = self._extract_http_methods(route_file)

                        endpoints.append({
                            "endpoint": new_route,
                            "metody": methods
                        })

                    endpoints.extend(self._scan_api(item, new_route))
        except PermissionError:
            pass

        return endpoints

    def _extract_http_methods(self, file_path):
        methods = []
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                content = f.read()
                for method in ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']:
                    if f'export async function {method}' in content or f'export function {method}' in content:
                        methods.append(method)
        except:
            pass
        return methods

    def generate_report(self):
        print("🔍 Skanowanie struktury projektu...")
        self.report['struktura'] = self.scan_directory(self.base_path)

        print("🔧 Wykrywanie technologii...")
        self.report['technologie'] = self.detect_technologies()

        print("🗺️  Analizowanie routingu...")
        self.report['routing'] = self.analyze_routing()

        print("🧩 Wyszukiwanie komponentów...")
        self.report['komponenty'] = self.find_components()

        print("🔌 Wyszukiwanie API endpoints...")
        self.report['api_endpoints'] = self.find_api_endpoints()

        self.report['statystyki'] = self.stats

        return self.report

    def save_report(self, filename="projekt_raport.json"):
        output_path = self.base_path / filename

        print(f"\n💾 Zapisywanie raportu...")
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(self.report, f, ensure_ascii=False, indent=2)

        print(f"✅ Raport zapisany: {output_path.absolute()}")
        print(f"\n📊 Statystyki:")
        print(f"   Plików: {self.stats['files']}")
        print(f"   Folderów: {self.stats['dirs']}")
        print(f"   TSX: {self.stats['tsx']}")
        print(f"   TS: {self.stats['ts']}")
        print(f"   CSS: {self.stats['css']}")
        print(f"   Technologii: {len(self.report['technologie'])}")
        print(f"   Route'ów: {len(self.report['routing'])}")
        print(f"   Komponentów: {len(self.report['komponenty'])}")
        print(f"   API endpoints: {len(self.report['api_endpoints'])}")


if __name__ == "__main__":
    analyzer = ProjectAnalyzer(".")
    report = analyzer.generate_report()
    analyzer.save_report()