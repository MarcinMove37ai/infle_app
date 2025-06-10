#!/usr/bin/env python3
"""
Skrypt do naprawienia Tailwind CSS w projekcie CRM
Automatycznie downgrade'uje z v4 do v3 i naprawia konfigurację

Autor: Claude AI Assistant
Data: 2025-01-07
"""

import os
import json
import shutil
from datetime import datetime
from pathlib import Path


class TailwindFixer:
    def __init__(self):
        # Sprawdź czy jesteśmy w katalogu ignore_py_files
        current_dir = Path.cwd()
        if current_dir.name == "ignore_py_files":
            # Przejdź do katalogu nadrzędnego (crm-system)
            self.project_root = current_dir.parent
            self.log(f"🔍 Wykryto uruchomienie z katalogu ignore_py_files")
            self.log(f"📁 Automatycznie przełączam na katalog projektu: {self.project_root}")
        else:
            self.project_root = current_dir

        self.backup_dir = self.project_root / "backup_tailwind_v4"

    def log(self, message, level="INFO"):
        """Logowanie z timestampem"""
        timestamp = datetime.now().strftime("%H:%M:%S")
        print(f"[{timestamp}] {level}: {message}")

    def verify_project_structure(self):
        """Sprawdza czy jesteśmy w odpowiednim katalogu projektu"""
        # Sprawdź strukturę z plikami w src/
        required_files = ["src/package.json", "src/app/layout.tsx"]

        for file_path in required_files:
            if not (self.project_root / file_path).exists():
                self.log(f"Nie znaleziono pliku: {file_path}", "ERROR")
                return False

        # Sprawdź czy to projekt z Tailwind v4 (package.json jest w src/)
        package_json_path = self.project_root / "src" / "package.json"
        try:
            with open(package_json_path, 'r', encoding='utf-8') as f:
                package_data = json.load(f)
                tailwind_version = package_data.get('devDependencies', {}).get('tailwindcss', '')
                if tailwind_version and tailwind_version.startswith('^4'):
                    self.log(f"✅ Wykryto Tailwind v4: {tailwind_version}")
                else:
                    self.log(f"Projekt używa Tailwind: {tailwind_version}", "INFO")

        except Exception as e:
            self.log(f"Błąd odczytu src/package.json: {e}", "ERROR")
            return False

        return True

    def create_backup(self):
        """Tworzy kopię zapasową starych plików"""
        self.log("Tworzenie kopii zapasowej...")

        if self.backup_dir.exists():
            shutil.rmtree(self.backup_dir)
        self.backup_dir.mkdir()

        # Lista plików do zbackupowania (wszystkie w src/)
        files_to_backup = [
            "src/package.json",
            "src/tailwind.config.js",
            "src/postcss.config.mjs",
            "src/app/globals.css"
        ]

        for file_path in files_to_backup:
            src = self.project_root / file_path
            if src.exists():
                dst = self.backup_dir / file_path
                dst.parent.mkdir(parents=True, exist_ok=True)
                shutil.copy2(src, dst)
                self.log(f"Backup: {file_path}")

        self.log(f"Backup zapisany w: {self.backup_dir}")

    def write_package_json(self):
        """Zapisuje poprawiony package.json z Tailwind v3 (w src/)"""
        package_json_content = {
            "name": "new-crm-app",
            "version": "0.1.0",
            "private": True,
            "scripts": {
                "dev": "next dev",
                "build": "next build",
                "start": "next start",
                "lint": "next lint",
                "postinstall": "prisma generate",
                "db:generate": "prisma generate",
                "db:migrate": "prisma migrate dev",
                "db:push": "prisma db push",
                "db:seed": "prisma db seed",
                "db:studio": "prisma studio",
                "db:reset": "prisma migrate reset"
            },
            "prisma": {
                "seed": "tsx prisma/seed.ts"
            },
            "dependencies": {
                "@types/bcryptjs": "^2.4.6",
                "next": "15.2.4",
                "react": "^18.3.1",
                "react-dom": "^18.3.1",
                "next-auth": "^4.24.7",
                "@next-auth/prisma-adapter": "^1.0.7",
                "prisma": "^5.9.1",
                "@prisma/client": "^5.9.1",
                "bcryptjs": "^2.4.3",
                "lucide-react": "^0.487.0",
                "clsx": "^2.1.1",
                "tailwind-merge": "^2.6.0",
                "react-hook-form": "^7.55.0",
                "js-cookie": "^3.0.5"
            },
            "devDependencies": {
                "@types/node": "^20",
                "@types/react": "^18",
                "@types/react-dom": "^18",
                "@types/js-cookie": "^3.0.6",
                "eslint": "^9",
                "eslint-config-next": "15.2.4",
                "tailwindcss": "^3.4.0",
                "autoprefixer": "^10.4.0",
                "postcss": "^8.4.0",
                "typescript": "^5",
                "tsx": "^4.7.0"
            }
        }

        with open(self.project_root / "src" / "package.json", 'w', encoding='utf-8') as f:
            json.dump(package_json_content, f, indent=2, ensure_ascii=False)
        self.log("✅ src/package.json zapisany (Tailwind v3)")

    def write_tailwind_config(self):
        """Zapisuje poprawiony tailwind.config.js (w src/)"""
        tailwind_config_content = '''/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      animation: {
        "fade-in": "fadeIn 0.3s ease-out",
        "slide-in": "slideIn 0.3s ease-out",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        slideIn: {
          "0%": { transform: "translateX(-100%)" },
          "100%": { transform: "translateX(0)" },
        },
      },
    },
  },
  plugins: [],
}'''

        with open(self.project_root / "src" / "tailwind.config.js", 'w', encoding='utf-8') as f:
            f.write(tailwind_config_content)
        self.log("✅ src/tailwind.config.js zapisany (CommonJS v3)")

    def write_postcss_config(self):
        """Zapisuje poprawiony postcss.config.js (w src/)"""
        postcss_config_content = '''module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}'''

        # Usuń stary .mjs jeśli istnieje (w src/)
        old_postcss = self.project_root / "src" / "postcss.config.mjs"
        if old_postcss.exists():
            old_postcss.unlink()
            self.log("🗑️  Usunięto stary src/postcss.config.mjs")

        with open(self.project_root / "src" / "postcss.config.js", 'w', encoding='utf-8') as f:
            f.write(postcss_config_content)
        self.log("✅ src/postcss.config.js zapisany (v3 format)")

    def write_globals_css(self):
        """Zapisuje poprawiony globals.css"""
        globals_css_content = '''@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
    --card: 0 0% 100%;
    --card-foreground: 222.2 84% 4.9%;
    --popover: 0 0% 100%;
    --popover-foreground: 222.2 84% 4.9%;
    --primary: 221.2 83.2% 53.3%;
    --primary-foreground: 210 40% 98%;
    --secondary: 210 40% 96%;
    --secondary-foreground: 222.2 84% 4.9%;
    --muted: 210 40% 96%;
    --muted-foreground: 215.4 16.3% 46.9%;
    --accent: 210 40% 96%;
    --accent-foreground: 222.2 84% 4.9%;
    --destructive: 0 84.2% 60.2%;
    --destructive-foreground: 210 40% 98%;
    --border: 214.3 31.8% 91.4%;
    --input: 214.3 31.8% 91.4%;
    --ring: 221.2 83.2% 53.3%;
    --radius: 0.5rem;
  }

  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
    --card: 222.2 84% 4.9%;
    --card-foreground: 210 40% 98%;
    --popover: 222.2 84% 4.9%;
    --popover-foreground: 210 40% 98%;
    --primary: 217.2 91.2% 59.8%;
    --primary-foreground: 222.2 84% 4.9%;
    --secondary: 217.2 32.6% 17.5%;
    --secondary-foreground: 210 40% 98%;
    --muted: 217.2 32.6% 17.5%;
    --muted-foreground: 215 20.2% 65.1%;
    --accent: 217.2 32.6% 17.5%;
    --accent-foreground: 210 40% 98%;
    --destructive: 0 62.8% 30.6%;
    --destructive-foreground: 210 40% 98%;
    --border: 217.2 32.6% 17.5%;
    --input: 217.2 32.6% 17.5%;
    --ring: 224.3 76.3% 94.1%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}

/* Reset i podstawowe style */
* {
  box-sizing: border-box;
}

html {
  scroll-behavior: smooth;
  overflow-x: hidden;
}

body {
  margin: 0;
  padding: 0;
  overflow-x: hidden;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-rendering: optimizeLegibility;
}

/* Custom scrollbar */
::-webkit-scrollbar {
  width: 8px;
}

::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 4px;
}

::-webkit-scrollbar-thumb:hover {
  background: #a8a8a8;
}

/* Smooth transitions */
* {
  transition-property: color, background-color, border-color, text-decoration-color, fill, stroke, opacity, box-shadow, transform, filter, backdrop-filter;
  transition-timing-function: cubic-bezier(0.4, 0, 0.2, 1);
  transition-duration: 150ms;
}

/* Focus styles */
.focus-visible {
  @apply outline-none ring-2 ring-ring ring-offset-2;
}

/* Animation utilities */
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.animate-fade-in {
  animation: fadeIn 0.3s ease-out;
}

/* Loading animation */
@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: .5;
  }
}

.animate-pulse {
  animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}'''

        globals_css_path = self.project_root / "src" / "app" / "globals.css"
        with open(globals_css_path, 'w', encoding='utf-8') as f:
            f.write(globals_css_content)
        self.log("✅ src/app/globals.css zapisany (v3 format)")

    def check_layout_tsx(self):
        """Sprawdza czy layout.tsx ma import CSS"""
        layout_path = self.project_root / "src" / "app" / "layout.tsx"

        try:
            with open(layout_path, 'r', encoding='utf-8') as f:
                content = f.read()

            if "import './globals.css'" not in content:
                self.log("⚠️  layout.tsx nie ma importu './globals.css'", "WARNING")
                self.log("   Dodaj na początek pliku: import './globals.css'", "WARNING")
            else:
                self.log("✅ layout.tsx ma poprawny import CSS")

        except Exception as e:
            self.log(f"Błąd sprawdzania layout.tsx: {e}", "ERROR")

    def cleanup_old_files(self):
        """Czyści stare pliki v4 (w src/)"""
        files_to_remove = [
            "src/postcss.config.mjs"
        ]

        for file_path in files_to_remove:
            file_to_remove = self.project_root / file_path
            if file_to_remove.exists():
                file_to_remove.unlink()
                self.log(f"🗑️  Usunięto: {file_path}")

    def run_fix(self):
        """Główna funkcja naprawienia"""
        self.log("🚀 Rozpoczynam naprawienie Tailwind CSS...")
        self.log(f"📁 Katalog projektu: {self.project_root}")
        self.log(f"📁 Pliki konfiguracyjne w: {self.project_root}/src/")

        # Sprawdź strukturę projektu
        if not self.verify_project_structure():
            self.log(
                "❌ Niepoprawna struktura projektu. Upewnij się że jesteś w katalogu crm-system lub ignore_py_files.",
                "ERROR")
            return False

        # Utwórz backup
        self.create_backup()

        try:
            # Zapisz nowe pliki
            self.write_package_json()
            self.write_tailwind_config()
            self.write_postcss_config()
            self.write_globals_css()

            # Posprzątaj
            self.cleanup_old_files()

            # Sprawdź layout.tsx
            self.check_layout_tsx()

            self.log("✅ Wszystkie pliki zostały zaktualizowane!")
            self.print_next_steps()

            return True

        except Exception as e:
            self.log(f"❌ Błąd podczas naprawienia: {e}", "ERROR")
            self.log(f"💾 Pliki backup znajdują się w: {self.backup_dir}", "INFO")
            return False

    def print_next_steps(self):
        """Wyświetla instrukcje dalszych kroków"""
        print("\n" + "=" * 60)
        print("🎉 NAPRAWIENIE ZAKOŃCZONE SUKCESEM!")
        print("=" * 60)
        print("\n📋 NASTĘPNE KROKI:")
        print(f"\n1️⃣  Przejdź do katalogu src (gdzie są pliki konfiguracyjne):")
        print(f"   cd \"{self.project_root / 'src'}\"")
        print("\n2️⃣  Usuń stare zależności i cache:")
        print("   rm -rf node_modules package-lock.json")
        print("   rm -rf ../.next  # cache Next.js jest w katalogu głównym")
        print("   # Lub na Windows:")
        print("   # rmdir /s node_modules")
        print("   # del package-lock.json")
        print("   # rmdir /s ../.next")
        print("\n3️⃣  Zainstaluj poprawne wersje pakietów:")
        print("   npm install")
        print("\n4️⃣  Wróć do katalogu głównego i uruchom projekt:")
        print(f"   cd \"{self.project_root}\"")
        print("   npm run dev")
        print("\n5️⃣  Przetestuj czy style działają:")
        print("   - Otwórz http://localhost:3000")
        print("   - Sprawdź czy podstawowe klasy Tailwind działają")
        print("   - Np. bg-blue-500, text-white, p-4")
        print("\n💾 Backup starych plików:")
        print(f"   {self.backup_dir}")
        print("\n🔧 Jeśli coś nie działa, sprawdź:")
        print("   - Czy src/app/layout.tsx ma import './globals.css'")
        print("   - Czy nie ma błędów w konsoli przeglądarki")
        print("   - Czy serwer dev został zrestartowany")
        print("   - Czy package.json jest w katalogu src/")
        print("\n" + "=" * 60)


def main():
    """Funkcja główna"""
    print("🔧 Skrypt naprawienia Tailwind CSS v4 → v3")
    print("📝 Automatycznie downgrade'uje projekt do stabilnej wersji v3")
    print("📁 Struktura: D:\\inflee.app\\main_app\\crm-system\\src\\ (pliki konfiguracyjne)")
    print("📁 Uruchom z: D:\\inflee.app\\main_app\\crm-system\\ignore_py_files\\")
    print("-" * 60)

    # Potwierdzenie od użytkownika
    response = input("\n❓ Czy chcesz kontynuować? (tak/nie): ").lower().strip()
    if response not in ['tak', 't', 'yes', 'y']:
        print("❌ Anulowano.")
        return

    fixer = TailwindFixer()
    success = fixer.run_fix()

    if success:
        print("\n🎊 Gotowe! Tailwind CSS został naprawiony.")
    else:
        print("\n💥 Wystąpił błąd. Sprawdź logi powyżej.")


if __name__ == "__main__":
    main()