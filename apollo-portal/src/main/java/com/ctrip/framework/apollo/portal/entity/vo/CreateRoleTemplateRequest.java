package com.ctrip.framework.apollo.portal.entity.vo;

/**
 * 创建角色模板请求
 */
public class CreateRoleTemplateRequest {

    private String templateName;
    private String description;

    public String getTemplateName() {
        return templateName;
    }

    public void setTemplateName(String templateName) {
        this.templateName = templateName;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }
}
