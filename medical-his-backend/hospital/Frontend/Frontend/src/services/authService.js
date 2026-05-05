import { AUTH_BASE_URL } from './apiClient';

export const loginUser = async (email, password) => {
    const response = await fetch(`${AUTH_BASE_URL}/login`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
            mail: email,       
            password: password
        }),
    });

    if (!response.ok) {
        throw new Error(`请求失败（HTTP ${response.status}）`);
    }

    return await response.json();
};

export const registerUser = async (name, email, password, role) => {
    const response = await fetch(`${AUTH_BASE_URL}/register`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
            name: name,
            email: email,
            password: password,
            role: role,
        }),
    });

    if (!response.ok) {
        throw new Error(`请求失败（HTTP ${response.status}）`);
    }

    return await response.json(); 
};