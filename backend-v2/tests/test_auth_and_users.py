def login_as_admin(client):
    response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "admin123456"},
    )
    assert response.status_code == 200
    return response.json()


def auth_headers(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_login_refresh_and_me(client):
    login_data = login_as_admin(client)
    access_token = login_data["access_token"]
    refresh_token = login_data["refresh_token"]

    me_response = client.get("/api/me", headers=auth_headers(access_token))
    assert me_response.status_code == 200
    assert me_response.json()["username"] == "admin"
    assert "system_admin" in me_response.json()["roles"]

    refresh_response = client.post("/api/auth/refresh", json={"refresh_token": refresh_token})
    assert refresh_response.status_code == 200
    assert refresh_response.json()["user"]["username"] == "admin"
    assert refresh_response.json()["access_token"]


def test_user_create_list_and_disable(client):
    login_data = login_as_admin(client)
    headers = auth_headers(login_data["access_token"])

    create_response = client.post(
        "/api/users",
        headers=headers,
        json={
            "username": "reviewer1",
            "password": "Passw0rd!",
            "display_name": "复核员一号",
            "roles": ["manual_reviewer", "analysis_viewer"],
        },
    )
    assert create_response.status_code == 200
    created_user = create_response.json()
    assert created_user["username"] == "reviewer1"
    assert set(created_user["roles"]) == {"manual_reviewer", "analysis_viewer"}
    assert created_user["is_active"] is True

    list_response = client.get("/api/users", headers=headers)
    assert list_response.status_code == 200
    usernames = {user["username"] for user in list_response.json()}
    assert {"admin", "reviewer1"}.issubset(usernames)

    disable_response = client.patch(
        f"/api/users/{created_user['id']}/status",
        headers=headers,
        json={"is_active": False},
    )
    assert disable_response.status_code == 200
    assert disable_response.json()["is_active"] is False
