# Local Installation Guide: Running with Docker Compose

This guide explains how to set up and run the Vibe Survival Game project locally using Docker Compose.

---

## Prerequisites

- [Docker](https://www.docker.com/get-started) (v20+ recommended)
- [Docker Compose](https://docs.docker.com/compose/) (v2+ recommended)
- (Optional) [Git](https://git-scm.com/) if you are cloning the repository

---

## Steps

### 1. Clone the Repository

```
git clone <your-repo-url>
cd vibe-coding-starter-pack-2d-multiplayer-survival
```

### 2. Build and Start the Services

From the project root, run:

```
docker compose up --build
```

This will build and start the following services:
- **client**: The web frontend
- **auth-server**: The OpenID Connect authentication server
- **spacetime-server**: The SpacetimeDB backend

### 3. Access the Application

- Open your browser and go to: [http://localhost](http://localhost)
- The game client should load. You can sign in or register using the authentication flow.

### 4. Stopping the Services

To stop all services, press `Ctrl+C` in the terminal where Docker Compose is running, or run:

```
docker compose down
```

---

## Troubleshooting

- **Blank Page or 304 Errors:**
  - Try a hard refresh in your browser (Ctrl+Shift+R or Cmd+Shift+R).
  - Check the browser console for JavaScript errors.

- **Auth Server Not Reachable:**
  - Ensure `AUTH_SERVER_URL` in the client config is set to `http://localhost:4001`.
  - Make sure port 4001 is not in use by another process.

- **SpacetimeDB Not Running:**
  - Check logs with `docker compose logs spacetime-server`.
  - Ensure port 3000 is available.

- **Database or Auth Errors:**
  - Check logs for `auth-server` and `spacetime-server` for error messages.

- **Rebuilding Everything:**
  - If you change code or configs, rebuild with:
    ```
    docker compose down
    docker compose build --no-cache
    docker compose up
    ```

---

## Useful Commands

- View running containers:
  ```
  docker compose ps
  ```
- View logs for a service:
  ```
  docker compose logs <service-name>
  ```
- Stop all services:
  ```
  docker compose down
  ```

---

## Notes

- The default login/register flow uses the local OpenAuth server.
- All data is stored in Docker volumes or the `server/data` directory.
- For development, you can modify the client or server code and rebuild the relevant service.

---

For further help, check the project README or contact the maintainers. 