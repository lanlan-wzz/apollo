package com.ctrip.framework.apollo.portal.entity.vo;

import java.util.List;

/**
 * 批量添加应用请求
 */
public class BatchAddAppsRequest {

    private List<AppPermissionConfig> apps;

    public List<AppPermissionConfig> getApps() {
        return apps;
    }

    public void setApps(List<AppPermissionConfig> apps) {
        this.apps = apps;
    }
}
