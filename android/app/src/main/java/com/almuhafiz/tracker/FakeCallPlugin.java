package com.almuhafiz.tracker;

import android.content.Intent;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

@CapacitorPlugin(name = "FakeCall")
public class FakeCallPlugin extends Plugin {

    @PluginMethod
    public void startFakeCall(PluginCall call) {
        String callerName = call.getString("callerName", "Alert Service");
        String callerNumber = call.getString("callerNumber", "+92-300-0000-0000");
        String alertType = call.getString("alertType", "");
        String deviceName = call.getString("deviceName", "");
        String message = call.getString("message", "");

        Intent intent = new Intent(getActivity(), FakeCallActivity.class);
        intent.putExtra("callerName", callerName);
        intent.putExtra("callerNumber", callerNumber);
        intent.putExtra("alertType", alertType);
        intent.putExtra("deviceName", deviceName);
        intent.putExtra("message", message);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);

        getActivity().startActivity(intent);
        
        JSObject ret = new JSObject();
        ret.put("success", true);
        call.resolve(ret);
    }
}

