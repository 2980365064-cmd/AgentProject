package com.hms.entity;

public enum Role {
    ADMIN("管理员"),
    PATIENT("患者");

    private final String description;

    Role(String description) {
        this.description = description;
    }

    public String getDescription() {
        return description;
    }
}
