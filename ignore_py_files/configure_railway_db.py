#!/usr/bin/env python3
"""
Skrypt do konfiguracji Railway PostgreSQL
Pomaga skonfigurować DATABASE_URL i testuje połączenie
"""

import os
import subprocess
import shutil
from pathlib import Path


def find_project_root():
    """Znajduje główny folder projektu"""
    current_path = Path(__file__).parent
    while current_path.parent != current_path:
        current_path = current_path.parent
        if (current_path / 'package.json').exists():
            return current_path
    return Path(__file__).parent.parent


def show_railway_info():
    """Pokazuje informacje o Railway PostgreSQL"""
    print("🚂 KONFIGURACJA RAILWAY POSTGRESQL")
    print("=" * 50)
    print("📋 Potrzebujesz danych z Railway:")
    print("   1. Przejdź do: https://railway.app")
    print("   2. Wybierz swój projekt")
    print("   3. Kliknij na bazę PostgreSQL")
    print("   4. Zakładka 'Connect'")
    print("   5. Skopiuj 'Database URL' lub 'Connection URL'")
    print()
    print("🔗 Format Railway Database URL:")
    print("   postgresql://postgres:password@host:port/railway")
    print()
    print("📍 Przykład:")
    print("   postgresql://postgres:abc123@containers-us-west-1.railway.app:5432/railway")
    print()


def configure_env_file():
    """Konfiguruje plik .env z Railway DATABASE_URL"""
    project_root = find_project_root()
    env_path = project_root / '.env'

    # Backup istniejącego .env
    if env_path.exists():
        backup_path = env_path.with_suffix('.env.backup')
        shutil.copy2(env_path, backup_path)
        print(f"📦 Backup: {backup_path}")

    print("🔧 KONFIGURACJA DATABASE_URL")
    print("-" * 30)

    # Pobierz DATABASE_URL od użytkownika
    database_url = input("📋 Wklej Railway Database URL: ").strip()

    if not database_url:
        print("❌ Nie podano URL!")
        return False

    if not database_url.startswith('postgresql://'):
        print("❌ URL powinien zaczynać się od 'postgresql://'")
        return False

    # Utwórz nowy .env
    env_content = f'''# Railway PostgreSQL Database
DATABASE_URL="{database_url}"

# NextAuth.js Configuration
NEXTAUTH_SECRET="your-super-secret-key-change-this-in-production"
NEXTAUTH_URL="http://localhost:3000"

# Supervisor Registration Code
SUPERVISOR_CODE="admin123"

# Environment
NODE_ENV="development"
'''

    with open(env_path, 'w', encoding='utf-8') as f:
        f.write(env_content)

    print("✅ Zaktualizowano .env z Railway DATABASE_URL")
    return True


def test_database_connection():
    """Testuje połączenie z bazą danych"""
    project_root = find_project_root()

    print("\n🔍 TESTOWANIE POŁĄCZENIA...")
    print("-" * 30)

    # Test 1: Prisma generate
    print("1️⃣  Generowanie klienta Prisma...")
    try:
        result = subprocess.run(
            ["npx", "prisma", "generate"],
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode == 0:
            print("✅ Prisma generate - sukces")
        else:
            print("❌ Prisma generate - błąd:")
            print(result.stderr)
            return False

    except Exception as e:
        print(f"❌ Błąd Prisma generate: {e}")
        return False

    # Test 2: Database push
    print("\n2️⃣  Testowanie połączenia z bazą...")
    try:
        result = subprocess.run(
            ["npx", "prisma", "db", "push"],
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=120
        )

        if result.returncode == 0:
            print("✅ Połączenie z bazą - sukces!")
            print("✅ Tabele zostały utworzone")
            return True
        else:
            print("❌ Błąd połączenia z bazą:")
            print(result.stderr)

            # Sprawdź typowe błędy
            if "ENOTFOUND" in result.stderr:
                print("\n💡 Możliwe przyczyny:")
                print("   - Sprawdź czy host jest prawidłowy")
                print("   - Sprawdź połączenie internetowe")
            elif "authentication failed" in result.stderr:
                print("\n💡 Możliwe przyczyny:")
                print("   - Sprawdź username i password")
                print("   - Sprawdź czy baza jest dostępna")
            elif "connection refused" in result.stderr:
                print("\n💡 Możliwe przyczyny:")
                print("   - Sprawdź port (zwykle 5432)")
                print("   - Sprawdź czy baza jest uruchomiona")

            return False

    except subprocess.TimeoutExpired:
        print("⏰ Timeout - połączenie trwa zbyt długo")
        return False
    except Exception as e:
        print(f"❌ Błąd: {e}")
        return False


def run_database_seed():
    """Uruchamia seed bazy danych"""
    project_root = find_project_root()

    print("\n🌱 URUCHAMIANIE SEED...")
    print("-" * 25)

    try:
        result = subprocess.run(
            ["npx", "prisma", "db", "seed"],
            cwd=project_root,
            capture_output=True,
            text=True,
            timeout=60
        )

        if result.returncode == 0:
            print("✅ Database seed - sukces!")
            print("👤 Utworzono użytkowników testowych")
            return True
        else:
            print("❌ Database seed - błąd:")
            print(result.stderr)
            return False

    except subprocess.TimeoutExpired:
        print("⏰ Seed timeout")
        return False
    except Exception as e:
        print(f"❌ Błąd seed: {e}")
        return False


def show_success_info():
    """Pokazuje informacje o sukcesie"""
    print("\n" + "=" * 60)
    print("🎉 RAILWAY POSTGRESQL SKONFIGUROWANY!")
    print("=" * 60)
    print("✅ Database URL skonfigurowany")
    print("✅ Połączenie z bazą działa")
    print("✅ Tabele utworzone")
    print("✅ Dane testowe załadowane")
    print()
    print("👤 KONTA TESTOWE:")
    print("   📧 admin@crm.com / admin123 (ADMIN)")
    print("   📧 supervisor@crm.com / admin123 (SUPERVISOR)")
    print("   📧 manager@crm.com / admin123 (MANAGER)")
    print("   📧 user@crm.com / user123 (USER)")
    print("   📧 pending@crm.com / user123 (USER - PENDING)")
    print()
    print("🚀 NASTĘPNE KROKI:")
    print("   1. npm run dev")
    print("   2. Otwórz http://localhost:3000")
    print("   3. Zaloguj się jednym z kont testowych")
    print()
    print("🔧 DODATKOWE KOMENDY:")
    print("   npx prisma studio  - GUI do bazy danych")
    print("   npx prisma db seed - ponowne załadowanie danych")


def check_prerequisites():
    """Sprawdza wymagania"""
    project_root = find_project_root()

    # Sprawdź czy istnieje schema.prisma
    schema_path = project_root / 'prisma' / 'schema.prisma'
    if not schema_path.exists():
        print("❌ Brak prisma/schema.prisma")
        print("💡 Uruchom najpierw: python setup_prisma.py")
        return False

    # Sprawdź czy istnieje package.json
    package_path = project_root / 'package.json'
    if not package_path.exists():
        print("❌ Brak package.json")
        return False

    print("✅ Wymagania spełnione")
    return True


def main():
    """Główna funkcja konfiguracji Railway"""
    print("🚂 Konfiguracja Railway PostgreSQL...")
    print()

    # Sprawdź wymagania
    if not check_prerequisites():
        return

    # Pokaż instrukcje Railway
    show_railway_info()

    # Konfiguruj .env
    if not configure_env_file():
        return

    # Testuj połączenie
    if not test_database_connection():
        return

    # Uruchom seed
    seed_choice = input("\n🌱 Czy uruchomić seed (dane testowe)? (Y/n): ").lower()
    if seed_choice != 'n':
        if run_database_seed():
            show_success_info()
        else:
            print("⚠️  Seed nie powiódł się, ale baza jest skonfigurowana")
            print("💡 Możesz uruchomić później: npx prisma db seed")
    else:
        print("\n✅ Railway PostgreSQL skonfigurowany!")
        print("💡 Uruchom seed później: npx prisma db seed")


if __name__ == "__main__":
    main()
