package com.ctrip.framework.apollo.portal.entity.vo;

import java.util.List;

/**
 * 分配用户请求
 */
public class AssignUsersRequest {

    private List<String> userIds;

    public List<String> getUserIds() {
        return userIds;
    }

    public void setUserIds(List<String> userIds) {
        this.userIds = userIds;
    }
}
