package com.ctrip.framework.apollo.portal.entity.vo;

import java.util.List;

/**
 * 批量操作结果
 */
public class BatchOperationResult {

    private int total;
    private int success;
    private int failed;
    private List<String> successList;
    private List<String> failedList;

    public BatchOperationResult() {
    }

    public BatchOperationResult(List<String> successList, List<String> failedList) {
        this.successList = successList;
        this.failedList = failedList;
        this.success = successList.size();
        this.failed = failedList.size();
        this.total = success + failed;
    }

    public int getTotal() {
        return total;
    }

    public void setTotal(int total) {
        this.total = total;
    }

    public int getSuccess() {
        return success;
    }

    public void setSuccess(int success) {
        this.success = success;
    }

    public int getFailed() {
        return failed;
    }

    public void setFailed(int failed) {
        this.failed = failed;
    }

    public List<String> getSuccessList() {
        return successList;
    }

    public void setSuccessList(List<String> successList) {
        this.successList = successList;
    }

    public List<String> getFailedList() {
        return failedList;
    }

    public void setFailedList(List<String> failedList) {
        this.failedList = failedList;
    }
}
