package com.hms.util;

import lombok.Data;

@Data
public class Response<T> {
    private String status;
    private String message;
    private T data;

    public Response() {
    }

    public Response(String success, String message) {
        this.status = success;
        this.message = message;
    }

    public Response(String success) {
        this.status = success;
    }

    public Response(String status, String message, T data) {
        this.status = status;
        this.message = message;
        this.data = data;
    }
}
