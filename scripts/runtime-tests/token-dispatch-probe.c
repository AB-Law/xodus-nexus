/* Synthetic IUser ABI regression fixture. No real account, tokens or network.
 * Authorization waits on a gate then FAILS; success is never fabricated. */
#define COBJMACROS
#define INITGUID
#include <windows.h>
#include <winstring.h>
#include <stdio.h>
#include "xtaskqueue.h"
#include "xasyncprovider.h"
#include "xuser.h"
#include "userprovider.h"

struct endpoint {
    HSTRING protocol, host, path, relyingParty, tokenType;
    void *policy;
    BOOL wildcard;
};
/* Only this private prefix is accessed by auth_metadata. */
struct XUser {
    IUser iface;
    LONG refs;
    void *key;
    char *proofKey, *userToken, *deviceToken, *titleToken;
    BYTE unused[2048];
    HANDLE started, gate;
    LONG request_thread;
};
static HSTRING relying_party, token_type;
static LONG checks, failures;
#define CHECK(name, value) do { ++checks; if (!(value)) { ++failures; printf("FAIL %s\n", name); } } while (0)
static ULONG WINAPI addref(IUser *iface) { return InterlockedIncrement(&((struct XUser *)iface)->refs); }
static ULONG WINAPI release(IUser *iface) { return InterlockedDecrement(&((struct XUser *)iface)->refs); }
static HRESULT WINAPI initialize(IUser *iface, XUserAddOptions options) { return E_NOTIMPL; }
static HRESULT WINAPI endpoint_info(IUser *iface, const char *url, struct endpoint *info) {
    ZeroMemory(info, sizeof(*info)); info->relyingParty = relying_party; info->tokenType = token_type; return S_OK;
}
static HRESULT WINAPI authorize(IUser *iface, const WCHAR *party, WCHAR **auth) {
    struct XUser *user = (void *)iface;
    user->request_thread = GetCurrentThreadId();
    SetEvent(user->started);
    WaitForSingleObject(user->gate, 1500);
    return E_FAIL;
}
static HRESULT WINAPI sign_request(IUser *iface, UINT32 version, const char *method, const char *url, const char *auth, UINT32 size, const void *body, char signature[104]) { return E_NOTIMPL; }
static IUserVtbl vtbl = { NULL, addref, release, initialize, endpoint_info, authorize, sign_request };
static LONG callbacks;
static void WINAPI complete(XAsyncBlock *block) { InterlockedIncrement(&callbacks); }
int main(void) {
    HMODULE dll = LoadLibraryA("xgameruntime.dll");
    HRESULT (WINAPI *query)(const GUID *, REFIID, void **);
    IXThreadingImpl *threads;
    IXUserImpl *users;
    UINT test;
    if (!dll || !(query = (void *)GetProcAddress(dll, "QueryApiImpl")) ||
        FAILED(query(&CLSID_XThreadingImpl, &IID_IXThreadingImpl, (void **)&threads)) ||
        FAILED(query(&CLSID_XUserImpl, &IID_IXUserImpl, (void **)&users))) return 2;
    WindowsCreateString(L"https://example.invalid", 23, &relying_party);
    WindowsCreateString(L"JWT", 3, &token_type);
    for (test = 0; test < 4; ++test) {
        struct XUser user = {0};
        XTaskQueueHandle queue;
        XAsyncBlock block = {0};
        ULONGLONG start, elapsed;
        HRESULT hr;
        user.iface.lpVtbl = &vtbl; user.refs = 1;
        user.started = CreateEventA(NULL, TRUE, FALSE, NULL);
        user.gate = CreateEventA(NULL, TRUE, FALSE, NULL);
        callbacks = 0;
        CHECK("manual-queue", IXThreadingImpl_XTaskQueueCreate(threads, XTaskQueueDispatchMode_Manual, XTaskQueueDispatchMode_Manual, &queue) == S_OK);
        block.queue = queue; block.callback = complete;
        hr = test & 1 ? IXUserImpl_XUserGetTokenAndSignatureUtf16Async(users, &user, 0, L"GET", L"https://example.invalid", 0, NULL, 0, NULL, &block) :
            IXUserImpl_XUserGetTokenAndSignatureAsync(users, &user, 0, "GET", "https://example.invalid", 0, NULL, 0, NULL, &block);
        CHECK("begin", hr == S_OK);
        start = GetTickCount64();
        CHECK("work-dispatch", IXThreadingImpl_XTaskQueueDispatch(threads, queue, XTaskQueuePort_Work, 0));
        elapsed = GetTickCount64() - start;
        printf("DISPATCH test=%u elapsed_ms=%llu\n", test, elapsed);
        CHECK("dispatch-does-not-wait-for-auth", elapsed < 200);
        CHECK("worker-started", WaitForSingleObject(user.started, 1500) == WAIT_OBJECT_0);
        CHECK("authorization-not-on-dispatch-thread", user.request_thread != GetCurrentThreadId());
        CHECK("pending-before-auth-returns", IXThreadingImpl_XAsyncGetStatus(threads, &block, FALSE) == E_PENDING);
        if (test >= 2) {
            IXThreadingImpl_XAsyncCancel(threads, &block);
            /* Existing runtime cancellation is best-effort/no-op. Force a
             * terminal abort to exercise Cleanup while authorization runs. */
            IXThreadingImpl_XAsyncComplete(threads, &block, E_ABORT, 0);
            while (IXThreadingImpl_XTaskQueueDispatch(threads, queue, XTaskQueuePort_Completion, 0));
            CHECK("cancel-status", IXThreadingImpl_XAsyncGetStatus(threads, &block, FALSE) == E_ABORT);
            CHECK("user-retained-during-canceled-work", user.refs == 2);
        }
        SetEvent(user.gate);
        start = GetTickCount64();
        while ((user.refs != 1 || !callbacks) && GetTickCount64() - start < 2000) {
            IXThreadingImpl_XTaskQueueDispatch(threads, queue, XTaskQueuePort_Completion, 0); Sleep(1);
        }
        CHECK("completion-once", callbacks == 1);
        CHECK("real-failure-or-cancel", IXThreadingImpl_XAsyncGetStatus(threads, &block, FALSE) == (test >= 2 ? E_ABORT : E_FAIL));
        CHECK("user-reference-released", user.refs == 1);
        IXThreadingImpl_XTaskQueueCloseHandle(threads, queue);
        CloseHandle(user.started); CloseHandle(user.gate);
    }
    WindowsDeleteString(relying_party); WindowsDeleteString(token_type);
    IXUserImpl_Release(users); IXThreadingImpl_Release(threads);
    printf("CHECKS %ld FAILURES %ld\n", checks, failures);
    return failures ? 1 : 0;
}
