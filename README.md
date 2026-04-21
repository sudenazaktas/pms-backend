# PMS Backend

Project Matching Platform — Node.js + Express + SQLite backend.

## Kurulum

```bash
npm install
cp .env.example .env
npm run dev
```

Backend: http://localhost:3000
Frontend: http://localhost:5173 (ayrı terminalde)

## Demo Hesaplar (şifre: 123456)

| Email | Rol |
|-------|-----|
| sevinc.yigit@ogr.university.edu.tr | Öğrenci |
| sila.korklubasoglu@university.edu.tr | Danışman |
| admin@university.edu.tr | Admin |

## Endpoint'ler

| Method | Path | Açıklama | Rol |
|--------|------|----------|-----|
| POST | /auth/login | Giriş yap | Herkese açık |
| GET | /projects | Proje listesi | Tümü |
| POST | /projects | Proje oluştur | Student |
| GET | /advisors | Danışman listesi | Tümü |
| POST | /advisors/:id/request | Danışmana istek gönder | Student |
| GET | /requests | Gelen istekler | Advisor |
| PATCH | /requests/:id | İsteği kabul/ret et | Advisor |
| GET | /announcements | Duyurular | Tümü |
| POST | /announcements | Duyuru oluştur | Admin |
| GET | /users/students | Öğrenci listesi | Admin |
| GET | /users/me | Kendi bilgilerini getir | Tümü |

## Frontend Bağlama

`src/data/api.js` dosyasını frontend'in `src/` klasörüne kopyala.
Sonra App.jsx'te import et:

```js
import { login, getProjects, createProject } from "./api";
```

Login örneği:
```js
async function handleLogin() {
  try {
    const { token, user } = await login(loginForm.email, loginForm.password);
    localStorage.setItem("pms_token", token);
    setCurrentUser(user);
    setRole(user.role);
    setLoggedIn(true);
  } catch (err) {
    setMessage(err.message);
  }
}
```
