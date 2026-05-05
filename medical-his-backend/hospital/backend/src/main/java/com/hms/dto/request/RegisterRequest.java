// D:\TOOL\Project\JavaProject\hospital\backend\src\main\java\com\hms\dto\request\RegisterRequest.java
package com.hms.dto.request;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.ToString;

@AllArgsConstructor
@NoArgsConstructor
@Data
@ToString
public class RegisterRequest {
    private String name;
    private String password;
    private String email;
    private String role; // PATIENT 或 ADMIN
}
