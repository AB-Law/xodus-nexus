#define COBJMACROS
#include <windows.h>
#include <stdio.h>
#include <stdlib.h>
#include <unknwn.h>
#include <winstring.h>

typedef void (__cdecl *PAPPSTATE_CHANGE_ROUTINE)(BOOLEAN,void*);
typedef struct _APPSTATE_REGISTRATION *PAPPSTATE_REGISTRATION;
typedef ULONG (WINAPI *register_fn)(PAPPSTATE_CHANGE_ROUTINE,void*,PAPPSTATE_REGISTRATION*);
typedef void (WINAPI *unregister_fn)(PAPPSTATE_REGISTRATION);
static LONG checks, failures, callbacks;
#define CHECK(x) do { InterlockedIncrement(&checks); if (!(x)) { InterlockedIncrement(&failures); printf("FAIL line=%d\n",__LINE__); } } while(0)
static void __cdecl callback(BOOLEAN state,void *context){(void)state;(void)context;InterlockedIncrement(&callbacks);}

#ifdef APPSTATE_SOURCE_FIXTURE
static LONG allocations, fail_allocation;
static void *fixture_malloc(size_t size){void *p;if(InterlockedExchange(&fail_allocation,0))return NULL;p=malloc(size);if(p)InterlockedIncrement(&allocations);return p;}
static void fixture_free(void *p){if(p)InterlockedDecrement(&allocations);free(p);}
#define malloc fixture_malloc
#define free fixture_free
#include "appstate-registration.h"
#undef malloc
#undef free
#endif

static register_fn reg_state;
static unregister_fn unreg_state;
static PAPPSTATE_REGISTRATION concurrent_handles[8][128];
static DWORD WINAPI worker(void *arg)
{
    ULONG_PTR thread=(ULONG_PTR)arg;
    unsigned i;
    for(i=0;i<128;i++){
        PAPPSTATE_REGISTRATION handle=NULL;
        CHECK(reg_state(callback,(void*)(thread+1),&handle)==ERROR_SUCCESS);
        CHECK(handle!=NULL);
        concurrent_handles[thread][i]=handle;
        unreg_state(handle);
        if(!(i%7))unreg_state(handle);
    }
    return 0;
}
static DWORD WINAPI remove_same(void *handle){unreg_state((PAPPSTATE_REGISTRATION)handle);return 0;}

int main(void)
{
    HMODULE module=NULL;
    PAPPSTATE_REGISTRATION handles[128],out;
    HANDLE threads[8];
    unsigned i,j,k;
#ifdef APPSTATE_SOURCE_FIXTURE
    reg_state=RegisterAppStateChangeNotification;
    unreg_state=UnregisterAppStateChangeNotification;
#else
    module=LoadLibraryW(L"api-ms-win-core-psm-appnotify-l1-1-0.dll");
    CHECK(module!=NULL);
    if(module){reg_state=(register_fn)(void*)GetProcAddress(module,"RegisterAppStateChangeNotification");unreg_state=(unregister_fn)(void*)GetProcAddress(module,"UnregisterAppStateChangeNotification");}
#endif
    CHECK(reg_state!=NULL&&unreg_state!=NULL);
    if(!reg_state||!unreg_state)goto done;
    out=(PAPPSTATE_REGISTRATION)(ULONG_PTR)0x1234;
    CHECK(reg_state(NULL,NULL,&out)==ERROR_INVALID_PARAMETER);
    CHECK(out==NULL);
    CHECK(reg_state(callback,NULL,NULL)==ERROR_INVALID_PARAMETER);
    CHECK(reg_state(NULL,NULL,NULL)==ERROR_INVALID_PARAMETER);
    unreg_state(NULL);unreg_state((PAPPSTATE_REGISTRATION)(ULONG_PTR)0x1234);
    for(i=0;i<128;i++){
        handles[i]=NULL;
        CHECK(reg_state(callback,i?(void*)(ULONG_PTR)i:NULL,&handles[i])==ERROR_SUCCESS);
        CHECK(handles[i]!=NULL);
        for(j=0;j<i;j++)CHECK(handles[j]!=handles[i]);
    }
    CHECK(callbacks==0);
    for(i=0;i<128;i+=2)unreg_state(handles[i]);
    for(i=1;i<128;i+=2)unreg_state(handles[i]);
    for(i=0;i<128;i++)unreg_state(handles[i]);
    for(i=0;i<8;i++){threads[i]=CreateThread(NULL,0,worker,(void*)(ULONG_PTR)i,0,NULL);CHECK(threads[i]!=NULL);}
    for(i=0;i<8;i++)if(threads[i]){CHECK(WaitForSingleObject(threads[i],10000)==WAIT_OBJECT_0);CloseHandle(threads[i]);}
    for(i=0;i<8;i++)for(j=0;j<128;j++){
        CHECK(concurrent_handles[i][j]!=NULL);
        for(k=0;k<j;k++)CHECK(concurrent_handles[i][j]!=concurrent_handles[i][k]);
        if(i)for(k=0;k<128;k++)CHECK(concurrent_handles[i][j]!=concurrent_handles[i-1][k]);
    }
    out=NULL;CHECK(reg_state(callback,NULL,&out)==ERROR_SUCCESS&&out!=NULL);
    for(i=0;i<8;i++){threads[i]=CreateThread(NULL,0,remove_same,out,0,NULL);CHECK(threads[i]!=NULL);}
    for(i=0;i<8;i++)if(threads[i]){CHECK(WaitForSingleObject(threads[i],10000)==WAIT_OBJECT_0);CloseHandle(threads[i]);}
    CHECK(callbacks==0);
#ifdef APPSTATE_SOURCE_FIXTURE
    CHECK(allocations==0&&appstate_registrations==NULL);
    fail_allocation=1;out=(PAPPSTATE_REGISTRATION)(ULONG_PTR)0x1234;
    CHECK(reg_state(callback,NULL,&out)==ERROR_NOT_ENOUGH_MEMORY&&out==NULL);
    CHECK(allocations==0&&appstate_registrations==NULL);
    CHECK(reg_state(callback,&checks,&out)==ERROR_SUCCESS);
    CHECK(appstate_registrations->routine==callback&&appstate_registrations->context==&checks);
    unreg_state(out);
    appstate_next_id=~(ULONG_PTR)0-1;
    CHECK(reg_state(callback,NULL,&out)==ERROR_SUCCESS&&(ULONG_PTR)out==~(ULONG_PTR)0);
    handles[0]=out;out=(PAPPSTATE_REGISTRATION)(ULONG_PTR)0x1234;
    CHECK(reg_state(callback,NULL,&out)==ERROR_NOT_ENOUGH_MEMORY&&out==NULL);
    CHECK(allocations==1);unreg_state(handles[0]);CHECK(allocations==0);
    appstate_next_id=0;
    for(i=0;i<3;i++)CHECK(reg_state(callback,NULL,&out)==ERROR_SUCCESS);
    CHECK(allocations==3);appstate_free_registrations();
    CHECK(allocations==0&&appstate_registrations==NULL&&callbacks==0);
#else
    {
        typedef HRESULT (WINAPI *factory_fn)(HSTRING,void**);
        factory_fn factory=(factory_fn)(void*)GetProcAddress(module,"DllGetActivationFactory");
        const WCHAR name[]=L"Windows.System.Profile.AnalyticsInfo";
        HSTRING string=NULL;IUnknown *object=NULL;
        CHECK(factory!=NULL);
        CHECK(WindowsCreateString(name,ARRAYSIZE(name)-1,&string)==S_OK);
        if(factory){CHECK(factory(string,(void**)&object)==S_OK);CHECK(object!=NULL);if(object)IUnknown_Release(object);}
        WindowsDeleteString(string);
    }
#endif
done:
    if(module)FreeLibrary(module);
    printf("CHECKS appstate checks=%ld failures=%ld callbacks=%ld\n",checks,failures,callbacks);
    return failures?1:0;
}
