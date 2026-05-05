// D:\TOOL\Project\JavaProject\hospital\backend\src\main\java\com\hms\config\GlobalExceptionHandler.java
package com.hms.config;

import com.hms.util.Response;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

@RestControllerAdvice
public class GlobalExceptionHandler {

    private static final Logger logger = LoggerFactory.getLogger(GlobalExceptionHandler.class);

    /**
     * 处理所有未捕获的异常
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<Response<?>> handleException(Exception e) {
        logger.error("系统异常:", e);
        Response<?> response = new Response<>("error", "服务器内部错误: " + e.getMessage(), null);
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
    }

    /**
     * 处理运行时异常
     */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<Response<?>> handleRuntimeException(RuntimeException e) {
        logger.error("运行时异常:", e);
        Response<?> response = new Response<>("error", e.getMessage(), null);
        return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(response);
    }
}
