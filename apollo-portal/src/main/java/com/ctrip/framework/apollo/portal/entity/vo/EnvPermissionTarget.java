package com.ctrip.framework.apollo.portal.entity.vo;

import java.util.List;

/**
 * 环境维度的权限元数据
 */
public class EnvPermissionTarget {

  private String env;
  private boolean active;
  private boolean loadFailed;
  private String message;
  private List<ClusterPermissionTarget> clusters;

  public String getEnv() {
    return env;
  }

  public void setEnv(String env) {
    this.env = env;
  }

  public boolean isActive() {
    return active;
  }

  public void setActive(boolean active) {
    this.active = active;
  }

  public boolean isLoadFailed() {
    return loadFailed;
  }

  public void setLoadFailed(boolean loadFailed) {
    this.loadFailed = loadFailed;
  }

  public String getMessage() {
    return message;
  }

  public void setMessage(String message) {
    this.message = message;
  }

  public List<ClusterPermissionTarget> getClusters() {
    return clusters;
  }

  public void setClusters(List<ClusterPermissionTarget> clusters) {
    this.clusters = clusters;
  }
}
