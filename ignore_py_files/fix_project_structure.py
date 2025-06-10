#!/usr/bin/env python3
"""
Skrypt naprawczy dla struktury projektu Next.js
Usuwa nieprawidłowe duplikaty i naprawia konfigurację
"""

import os
import shutil
from pathlib import Path
import json


def find_project_root():
    """Znajduje główny folder projektu"""
    current_path = Path(__file__).parent
    while current_path.parent != current_path:
        current_path = current_path.parent
        if (current_path / 'package.json').exists():
            return current_path
    return Path(__file__).parent.parent


def backup_file(file_path):
    """Tworzy kopię zapasową pliku"""
    backup_path = file_path.with_suffix(file_path.suffix + '.backup')
    if file_path.exists():
        shutil.copy2(file_path, backup_path)
        print(f"📦 Kopia zapasowa: {backup_path}")


def fix_next_config():
    """Naprawia next.config.ts - usuwa przestarzałą konfigurację"""
    project_root = find_project_root()
    next_config_path = project_root / 'next.config.ts'

    if not next_config_path.exists():
        print("⚠️  Nie znaleziono next.config.ts")
        return

    backup_file(next_config_path)

    # Nowa, poprawna konfiguracja dla Next.js 15
    new_config = '''import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
};

export default nextConfig;
'''

    with open(next_config_path, 'w', encoding='utf-8') as f:
        f.write(new_config)

    print("✅ Naprawiono next.config.ts")


def remove_duplicate_files():
    """Usuwa nieprawidłowe duplikaty z folderu src/"""
    project_root = find_project_root()
    src_path = project_root / 'src'

    # Lista plików do usunięcia z src/
    files_to_remove = [
        'package.json',  # Nieprawidłowy JSON
        'next.config.ts',  # Duplikat
        'page.tsx',  # Niepotrzebny w src
        'layout.tsx',  # Pusty duplikat
        'tsconfig.json',  # Duplikat
        'postcss.config.mjs',  # Duplikat
        'tailwind.config.js',  # Duplikat
        'globals.css'  # Duplikat (pozostaw tylko w src/app/)
    ]

    for file_name in files_to_remove:
        file_path = src_path / file_name
        if file_path.exists():
            backup_file(file_path)
            file_path.unlink()
            print(f"🗑️  Usunięto: src/{file_name}")


def clean_build_cache():
    """Czyści cache Next.js"""
    project_root = find_project_root()
    cache_dirs = ['.next', 'node_modules/.cache']

    for cache_dir in cache_dirs:
        cache_path = project_root / cache_dir
        if cache_path.exists():
            shutil.rmtree(cache_path)
            print(f"🧹 Wyczyszczono cache: {cache_dir}")


def verify_main_package_json():
    """Sprawdza i naprawia główny package.json"""
    project_root = find_project_root()
    package_json_path = project_root / 'package.json'

    if not package_json_path.exists():
        print("❌ Brak głównego package.json!")
        return False

    try:
        with open(package_json_path, 'r', encoding='utf-8') as f:
            package_data = json.load(f)

        print(f"✅ Główny package.json jest prawidłowy")
        print(f"   📦 Projekt: {package_data.get('name', 'unknown')}")
        print(f"   🏷️  Wersja: {package_data.get('version', 'unknown')}")
        return True

    except json.JSONDecodeError as e:
        print(f"❌ Błąd w głównym package.json: {e}")
        return False


def check_typescript_config():
    """Sprawdza konfigurację TypeScript"""
    project_root = find_project_root()
    tsconfig_path = project_root / 'tsconfig.json'

    if tsconfig_path.exists():
        try:
            with open(tsconfig_path, 'r', encoding='utf-8') as f:
                tsconfig = json.load(f)

            # Sprawdź czy paths są poprawnie skonfigurowane
            paths = tsconfig.get('compilerOptions', {}).get('paths', {})
            if '@/*' in paths:
                print("✅ TypeScript paths są skonfigurowane")
            else:
                print("⚠️  Brak konfiguracji paths w tsconfig.json")

        except json.JSONDecodeError:
            print("❌ Błąd w tsconfig.json")
    else:
        print("⚠️  Brak tsconfig.json")


def create_env_example():
    """Tworzy .env.example jeśli nie istnieje"""
    project_root = find_project_root()
    env_example_path = project_root / '.env.example'

    if not env_example_path.exists():
        env_content = '''# Database
DATABASE_URL="your_database_url_here"

# NextAuth.js
NEXTAUTH_SECRET="your_nextauth_secret_here"
NEXTAUTH_URL="http://localhost:3000"

# Supervisor Code
SUPERVISOR_CODE="your_supervisor_code_here"
'''

        with open(env_example_path, 'w', encoding='utf-8') as f:
            f.write(env_content)

        print("✅ Utworzono .env.example")


def show_next_steps():
    """Pokazuje kolejne kroki do wykonania"""
    print("\n" + "=" * 50)
    print("🎯 KOLEJNE KROKI DO WYKONANIA:")
    print("=" * 50)
    print("1. Usuń folder .next:")
    print("   rm -rf .next")
    print()
    print("2. Zainstaluj dependencje:")
    print("   npm install")
    print()
    print("3. Sprawdź czy Prisma jest skonfigurowana:")
    print("   npx prisma generate")
    print("   npx prisma db push")
    print()
    print("4. Uruchom projekt:")
    print("   npm run dev")
    print()
    print("5. Jeśli nadal są błędy, sprawdź:")
    print("   - Czy plik .env zawiera prawidłowe wartości")
    print("   - Czy baza danych jest dostępna")
    print("   - Czy wszystkie dependencje są kompatybilne")


def main():
    """Główna funkcja naprawcza"""
    print("🚀 Rozpoczynanie naprawy struktury projektu Next.js...")
    print("=" * 50)

    project_root = find_project_root()
    print(f"📁 Projekt: {project_root}")
    print()

    # 1. Sprawdź główny package.json
    print("1️⃣  Sprawdzanie głównego package.json...")
    if not verify_main_package_json():
        print("❌ Nie można kontynuować - problem z package.json")
        return
    print()

    # 2. Usuń nieprawidłowe duplikaty
    print("2️⃣  Usuwanie nieprawidłowych duplikatów...")
    remove_duplicate_files()
    print()

    # 3. Napraw next.config.ts
    print("3️⃣  Naprawa next.config.ts...")
    fix_next_config()
    print()

    # 4. Sprawdź TypeScript
    print("4️⃣  Sprawdzanie konfiguracji TypeScript...")
    check_typescript_config()
    print()

    # 5. Utwórz .env.example
    print("5️⃣  Tworzenie .env.example...")
    create_env_example()
    print()

    # 6. Wyczyść cache
    print("6️⃣  Czyszczenie cache...")
    clean_build_cache()
    print()

    print("✅ Naprawa struktury zakończona!")
    show_next_steps()


if __name__ == "__main__":
    main()