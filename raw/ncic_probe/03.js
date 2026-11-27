/* dc-ajax.js
 * - dcpost(url, data).success(fn).error(fn)
 * - dcget(url, data).success(fn).error(fn)
 * - (겸용) dcpost(url, data, success, error), dcget(url, data, success, error)
 * - 성공 콜백 인자 == rst.data (없으면 형식 오류로 error)
 * - 성공 조건: rst.data.code === ST.SUCCESS (ST는 전역 상수)
 * - CSRF: 메타(_csrf/_csrf_header) 또는 전역(DC_CSRF_HEADER/DC_CSRF_TOKEN)에서 1회 자동 로드
 */

(function ($, w) {
  var CSRF = null, CSRF_LOADED = false;

  function loadCsrfOnce() {
    if (CSRF_LOADED) return; CSRF_LOADED = true;
    var h = $('meta[name="_csrf_header"]').attr('content');
    var t = $('meta[name="_csrf"]').attr('content');
    if (h && t) { CSRF = { header: h, token: t }; return; }
    if (w.DC_CSRF_HEADER && w.DC_CSRF_TOKEN) {
      CSRF = { header: w.DC_CSRF_HEADER, token: w.DC_CSRF_TOKEN };
    }
  }

  function defaultErr(e){
    var msg = (e && e.message) ? e.message : '처리 중 오류가 발생했습니다.';
    //alert(msg);
    try { console.error('[dc-ajax]', e); } catch(_){}
  }

  function send(method, url, data, onOk, onErr) {
    return $.ajax({
      url: url,
      type: method,
      // dataType 명시 안 함(현행 유지)
      contentType: 'application/x-www-form-urlencoded; charset=UTF-8',
      data: data || {},
      traditional: true,
      beforeSend: function (xhr) {
        loadCsrfOnce();
        if (CSRF) xhr.setRequestHeader(CSRF.header, CSRF.token);
      },
      success: function (rst) {
        try {
          var result = (rst && typeof rst === 'object' && Object.prototype.hasOwnProperty.call(rst, 'data')) ? rst.data : null;
          if (!result) {
            onErr && onErr({ message: '응답 형식 오류: data 없음', raw: rst });
            return;
          }
          if (result.code === ST.SUCCESS) {
            onOk && onOk(result);           // ✅ result === rst.data
          } else {
            onErr && onErr(result);         // 비즈니스 실패도 error로
          }
        } catch (e) {
          onErr && onErr(e);
        }
      },
      error: function (xhr, status, e) {
        onErr && onErr(xhr || e);
      }
    });
  }

  // 체이너(빌더): success/error를 나중에 붙여도 동작
  function makeChain(doSend, legacyOk, legacyErr) {
    var successQ = [], errorQ = [];
    var state = 'pending', payload;

    doSend(function (res) {               // ok
      state = 'ok'; payload = res;
      for (var i=0;i<successQ.length;i++) { try { successQ[i](res); } catch(_){} }
      if (legacyOk) try { legacyOk(res); } catch(_) {}
    }, function (err) {                   // err
      state = 'err'; payload = err;
      if (errorQ.length) {
        for (var j=0;j<errorQ.length;j++) { try { errorQ[j](err); } catch(_){} }
      } else if (legacyErr) {
        try { legacyErr(err); } catch(_) {}
      } else {
        defaultErr(err); // ✅ .error 미지정 시 기본 처리
      }
    });

    var api = {
      success: function (fn) { if (typeof fn==='function'){ state==='ok' ? fn(payload) : successQ.push(fn); } return api; },
      error:   function (fn) { if (typeof fn==='function'){ state==='err' ? fn(payload) : errorQ.push(fn);   } return api; }
    };
    return api;
  }

  // 공개 API
  w.dcpost = function (url, data, success, error) {
    return makeChain((ok, err)=>send('POST', url, data, ok, err), success, error);
  };
  w.dcget  = function (url, data, success, error) {
    return makeChain((ok, err)=>send('GET',  url, data, ok, err), success, error);
  };
})(jQuery, window);

/* 사용 예
dcpost('/api/item/save', { id: 1 })
  .success(function (result) {
    // result는 rst.data (이미 result.code === ST.SUCCESS 확인됨)
    console.log('OK', result);
  });
// 커스텀 에러가 필요할 때만 .error 추가
dcget('/api/item/detail', { id: 1 })
  .success(function (result) { /* ... *\/ })
  .error(function (e) { alert('커스텀: ' + (e?.message || '실패')); });

// (겸용) 기존 4인자 방식도 그대로 가능
dcpost('/api/legacy', { a:1 },
  function (result) { /* ok *\/ },
  function (e)       { /* err *\/ }
);
*/
