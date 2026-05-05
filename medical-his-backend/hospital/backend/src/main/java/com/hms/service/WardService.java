package com.hms.service;

import com.hms.dto.WardDTO;
import com.hms.entity.Ward;

import java.util.List;

public interface WardService {

    Ward create(WardDTO dto);

    List<Ward> getAll();

    Ward getById(Long id);

    Ward update(Long id, WardDTO dto);

    void delete(Long id);
}
