var lang_kr = {
	"pagination":{
		"page_size":"페이지 크기", //label for the page size select element
        "page_title":"Show Page",//tooltip text for the numeric page button, appears in front of the page number (eg. "Show Page" will result in a tool tip of "Show Page 1" on the page 1 button)
        "first":"처음", //text for the first page button
        "first_title":"첫페이지", //tooltip text for the first page button
        "last":"마지막",
        "last_title":"마지막 페이지",
        "prev":"이전으로",
        "prev_title":"이전 페이지",
        "next":"다음",
        "next_title":"다음 페이지",
        "all":"전체",
        "counter":{
            "showing": "Showing",
            "of": "of",
            "rows": "rows",
            "pages": "pages",
        }
	}
}

   
  
$(document).ready(function(){
	
	$(document).on('keyup' , '.engOnly' , function(){
		$(this).val( $(this).val().replace(/[0-9]|[^\!-z]/gi,"") );
	}).on('keyup' , '.onlyNum' , function(){
		$(this).val( comma($(this).val().replace(/[^0-9.]/gi,"")) );
	}).on('keyup' , '.onlyNumNotComma' , function(){
		$(this).val( $(this).val().replace(/[^0-9]/gi,""));	
	}).on('change' , '.hasOther' , function(){
		var parent = $(this).closest('td,div,dt,li');
		if($(this).val() == "기타"){
			parent.find('input[type="text"]').show(200);
		}else{
			parent.find('input[type="text"]').hide();
		}
	})
	
	if($('input[class*="datetimepicker"]').length > 0){
		
		$.datepicker.regional['ko'] = {
			closeText: '닫기',
			prevText: '이전달',
			nextText: '다음달',
			currentText: '오늘',
			monthNames: ['1월(JAN)','2월(FEB)','3월(MAR)','4월(APR)','5월(MAY)','6월(JUN)',
			'7월(JUL)','8월(AUG)','9월(SEP)','10월(OCT)','11월(NOV)','12월(DEC)'],
			monthNamesShort: ['1월','2월','3월','4월','5월','6월',
			'7월','8월','9월','10월','11월','12월'],
			dayNames: ['일','월','화','수','목','금','토'],
			dayNamesShort: ['일','월','화','수','목','금','토'],
			dayNamesMin: ['일','월','화','수','목','금','토'],
			weekHeader: 'Wk',
			dateFormat: 'yy-mm-dd',
			firstDay: 0,
			isRTL: false,
			showMonthAfterYear: true,
			yearSuffix: ''};
		$.datepicker.setDefaults($.datepicker.regional['ko']);
				
		$('input[class*="datetimepicker"]').datetimepicker({
			yearRange: 'c-80:c+10',
			buttonImageOnly: true,
			changeMonth: true,
			changeYear: true,
			showButtonPanel: true,
			// timepicker 설정
			timeFormat:'HH:mm',
			controlType:'select',
			oneLine:true,
			onSelect: function(selectedDate){
				
				var $this = $(this); // 현재 선택된 input 요소
	            var name = $this.attr("name"); // 현재 input의 name 속성 값
	            var isStartDate = name.endsWith("StartDate"); // name 속성 값이 'StartDate'로 끝나는지 확인

	            // 현재 input의 부모 요소를 찾음
	            var $parent = $this.closest('td, div, li');

	            // startDate와 endDate input 요소를 찾음
	            var $startDate = $parent.find("[name$='StartDate']");
	            var $endDate = $parent.find("[name$='EndDate']");

	            // startDate와 endDate의 값 가져오기
	            var startDate = $startDate.datepicker("getDate");
	            var endDate = $endDate.datepicker("getDate");
	            // startDate가 endDate보다 크면 alert를 띄우고 endDate를 빈값으로 설정
	            if (startDate != null && endDate != null && startDate > endDate) {
	                alert("시작일이 종료일보다 커서는 안됩니다.");
	                $endDate.val("");
	            }
				
			    	
			}
		});
		
	}
	
	
	
	if($('input[class*="datepicker"]').length > 0){
		$.datepicker.regional['ko'] = {
			closeText: '닫기',
			prevText: '이전달',
			nextText: '다음달',
			currentText: '오늘',
			monthNames: ['1월(JAN)','2월(FEB)','3월(MAR)','4월(APR)','5월(MAY)','6월(JUN)',
			'7월(JUL)','8월(AUG)','9월(SEP)','10월(OCT)','11월(NOV)','12월(DEC)'],
			monthNamesShort: ['1월','2월','3월','4월','5월','6월',
			'7월','8월','9월','10월','11월','12월'],
			dayNames: ['일','월','화','수','목','금','토'],
			dayNamesShort: ['일','월','화','수','목','금','토'],
			dayNamesMin: ['일','월','화','수','목','금','토'],
			weekHeader: 'Wk',
			dateFormat: 'yy-mm-dd',
			firstDay: 0,
			isRTL: false,
			showMonthAfterYear: true,
			yearSuffix: ''};
		$.datepicker.setDefaults($.datepicker.regional['ko']);
				
		$('input[class*="datepicker"]').datepicker({
			yearRange: "c-80:c+10",
			buttonImageOnly: true,
			changeMonth: true,
			changeYear: true,
			showButtonPanel: true,
			onSelect: function(selectedDate){
				
				var $this = $(this); // 현재 선택된 input 요소
	            var name = $this.attr("name"); // 현재 input의 name 속성 값
	            var isStartDate = name.endsWith("StartDate"); // name 속성 값이 'StartDate'로 끝나는지 확인

	            // 현재 input의 부모 요소를 찾음
	            var $parent = $this.closest('td, div, li');

	            // startDate와 endDate input 요소를 찾음
	            var $startDate = $parent.find("[name$='StartDate']");
	            var $endDate = $parent.find("[name$='EndDate']");

	            // startDate와 endDate의 값 가져오기
	            var startDate = $startDate.datepicker("getDate");
	            var endDate = $endDate.datepicker("getDate");
	            // startDate가 endDate보다 크면 alert를 띄우고 endDate를 빈값으로 설정
	            if (startDate != null && endDate != null && startDate > endDate) {
	                alert("시작일이 종료일보다 커서는 안됩니다.");
	                $endDate.val("");
	            }
				
			    	
			}
		});
		
		
		
	}
	
	 // 오늘 날짜 버튼 클릭 이벤트
    $(".date_today").click(function() {
        var $parent = $(this).closest('td, div, li'); // 부모 요소 찾기
        var today = new Date(); // 오늘 날짜
        today.setHours(0, 0, 0, 0); // 시간을 00:00으로 설정

        // StartDate, EndDate에 오늘 날짜 세팅
        $parent.find("[name$='StartDate'], [name$='EndDate']").each(function() {
            var $this = $(this);
            if ($this.hasClass('datetimepicker')) {
                // datetimepicker 클래스가 있는 경우 Y-m-d H:i 포맷으로 설정
                $this.val(formatDate(today, true));
            } else {
                // 클래스가 없는 경우 Y-m-d 포맷으로 설정
                $this.val(formatDate(today, false));
            }
        });
    });

    // 한 달 뒤 날짜 버튼 클릭 이벤트
    $(".date_month").click(function() {
        var $parent = $(this).closest('td, div, li'); // 부모 요소 찾기
        var today = new Date();
        var nextMonth = new Date(new Date(today).setMonth(today.getMonth() + 1)); // 오늘로부터 한 달 뒤
        nextMonth.setHours(0, 0, 0, 0); // 시간을 00:00으로 설정

        // StartDate에는 오늘, EndDate에는 한 달 뒤 날짜 세팅
        $parent.find("[name$='StartDate'], [name$='EndDate']").each(function() {
            var $this = $(this);
            if ($this.hasClass('datetimepicker')) {
                // datetimepicker 클래스가 있는 경우 Y-m-d 00:00 포맷으로 설정
                if ($this.attr("name").endsWith("StartDate")) {
                    $this.val(formatDate(new Date(), true)); // 오늘 날짜
                } else if ($this.attr("name").endsWith("EndDate")) {
                    $this.val(formatDate(nextMonth, true)); // 한 달 뒤 날짜
                }
            } else {
                // 클래스가 없는 경우 Y-m-d 포맷으로 설정
                if ($this.attr("name").endsWith("StartDate")) {
                    $this.val(formatDate(new Date(), false)); // 오늘 날짜
                } else if ($this.attr("name").endsWith("EndDate")) {
                    $this.val(formatDate(nextMonth, false)); // 한 달 뒤 날짜
                }
            }
        });
    });
    
    // 날짜 지우기 버튼 클릭 이벤트
    $(".date_clear").click(function() {
        var $parent = $(this).closest('td, div, li'); // 부모 요소 찾기

        // StartDate, EndDate 빈값으로 설정
        $parent.find("[name$='StartDate'], [name$='EndDate']").val("");
    });
	
	
	// 2023-11-22 confirm 팝업 닫기 추가 bk
	$('.layer_pop .pop_cancel').click(function(){
		$('.layer_pop').hide();
		if(typeof beforeFocus !== 'undefined'){
			beforeFocus.focus();
			beforeFocus = null;
		}
	})
	
	//자동검색에서 전체 버튼 컨트롤
	
		$('input[type="checkbox"][name$="CheckAll"]').click(function(){
			var val = $(this).is(':checked');
			var parent = $(this).closest('td, div, li');
			parent.find('input[type="checkbox"]').each(function(){
				$(this).prop('checked' , val);
			})
		})
		
		$('input[type="checkbox"][name$="CheckAll"]').each(function() {
	        var $checkAll = $(this);
	        var $parent = $checkAll.closest('td, div, li'); // 가장 가까운 div를 부모로 설정
	
	        // 'CheckAll'을 제외한 체크박스에 대한 클릭 이벤트 설정
	        $parent.find('input[type="checkbox"]').not('[name$="CheckAll"]').on('click', function() {
	            // 현재 부모 내에서 'CheckAll'을 제외한 모든 체크박스가 체크되었는지 확인
	            var allChecked = $parent.find('input[type="checkbox"]').not('[name$="CheckAll"]').length === 
	                             $parent.find('input[type="checkbox"]:checked').not('[name$="CheckAll"]').length;
	
	            // 모든 체크박스가 체크되었으면 'CheckAll'도 체크, 아니면 해제
	            $checkAll.prop('checked', allChecked);
	        });
	
	        // 'CheckAll' 체크박스에 대한 클릭 이벤트 설정
	        $checkAll.on('click', function() {
	            // 'CheckAll' 체크박스의 상태에 따라 모든 체크박스 상태 설정
	            var isChecked = $checkAll.is(':checked');
	            $parent.find('input[type="checkbox"]').not('[name$="CheckAll"]').prop('checked', isChecked);
	        });
	        
	    });
	
	//자동검색에서 전체 버튼 컨트롤 End
	
	//화면크기설정
	var zoomLevels = {
	  'sm': 0.9,
	  'md': 1,
	  'lg': 1.1,
	  'xlg': 1.2,
	  'xxlg': 1.3
	};
	
	// 저장된 값 불러오기
	function applySavedZoom() {
	  var savedZoom = localStorage.getItem('pageZoom') || 1;
	  $('body').css('zoom', savedZoom);
	
	  // active 클래스도 복원
	  $('.drop-list li, .drop-list .item-link').removeClass('active');
	  var selectedClass = Object.keys(zoomLevels).find(key => zoomLevels[key] == savedZoom);
	  if (selectedClass) {
	    var $target = $('.drop-list .item-link.' + selectedClass);
	    $target.closest('li').addClass('active');
	    $target.addClass('active');
	  }
	}
	applySavedZoom();
	
	// 사이즈 선택 버튼 클릭 시
	$('.drop-list .item-link').click(function(e) {
	  e.stopPropagation();
	  var selectedClass = $(this).attr('class').split(' ')[1]; // xsm, sm, md, lg, xlg
	  var zoom = zoomLevels[selectedClass];
	
	  $('body').css('zoom', zoom);
	  localStorage.setItem('pageZoom', zoom);  // 👉 선택값 저장
	
	  $('.drop-list li, .drop-list .item-link').removeClass('active');
	  $(this).closest('li').addClass('active');
	  $(this).addClass('active');
	});
	
	// 초기화 버튼 클릭 시
	$('.drop-bottom .krds-btn').click(function(e) {
	  e.stopPropagation();
	  $('body').css('zoom', 1);
	  localStorage.setItem('pageZoom', 1);  // 👉 초기화 시 저장값도 리셋
	
	  $('.drop-list li, .drop-list .item-link').removeClass('active');
	  
	  // "보통" 항목(li.sm)과 그 안의 button에 active 추가
	  var $normalLi = $('.drop-list li').eq(1); // 두번째 li (보통)
	  $normalLi.addClass('active');
	  $normalLi.find('.item-link').addClass('active');
	});
	//화면크기설정 end
	  
	//top 버튼
	goTopBtn();
	//top 버튼 end
	
})

//top 버튼
  const goTopBtn = () => {
    const contentArea = document.querySelector("#krds-footer > .inner");
    if (contentArea) {
      const goTopTag = document.createElement("button");
      goTopTag.className = "page-top-button krds-tooltip";
      goTopTag.type = "button";
      goTopTag.innerHTML = `<i class="svg-icon ico-go-top"></i>`;
      goTopTag.setAttribute("data-tooltip", "페이지 상단으로 이동");
      contentArea.append(goTopTag);

      const home = contentArea.querySelector(".breadcrumb .home a");
      const toggleVisibility = () => {
        goTopTag.classList.toggle("active", window.scrollY > window.innerHeight * 0.3); //나오는 위치 설정 기본 1.5
      };
      const scrollToTop = () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        home?.focus();
      };
      window.addEventListener("scroll", toggleVisibility);
      goTopTag.addEventListener("click", scrollToTop);
    }
  };
  //top 버튼 end


/**
 * 글자수제한 함수
 * @param limit - 제한 수
 * @param currentCountId - 현재 글자 수 id
 * @param maxCountId - 전체 글자 수 id
 * @returns
 */
function limitText(limit, textareaId , currentCountId, maxCountId) {
	const $textarea = $('#' + textareaId);
    const $currentCount = $('#' + currentCountId);
    const $maxCount = $('#' + maxCountId);

    // 최대 글자 수 설정
    $maxCount.text(limit);

    $textarea.on('input', function () {
        let text = $textarea.val();

        // 이모지 삭제
        text = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F700}-\u{1F77F}\u{1F780}-\u{1F7FF}\u{1F800}-\u{1F8FF}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}]/gu, '');

        // 글자 수 제한
        if (text.length > limit) {
            text = text.substring(0, limit);
            $textarea.val(text);
        }

        // 현재 글자 수 반영
        $currentCount.text(text.length);
    });
}

function formatDate(date, includeTime) {
    var day = ("0" + date.getDate()).slice(-2);
    var month = ("0" + (date.getMonth() + 1)).slice(-2);
    var year = date.getFullYear();
    var formattedDate = year + '-' + month + '-' + day;
    if (includeTime) {
        formattedDate += ' 00:00'; // 시간 포함
    }
    return formattedDate;
}

// class -> required가 들어간 폼 검증 [title값 필수]  [editor - 텍스트에디터]
function validate(){
	var check = true;
	var target = '';
	var type = '';
	
	$('.required').each(function(){
		if(check){
			
			if($(this).hasClass('editor')){
				var val = $.trim($(this).val());
				if(  val == '' || val == null || val == '&nbsp;' || val == '<p>&nbsp;</p>'){
					check = false;
					target = $(this).prop('title');
					type = 'blank';
					$(this).focus();
				}
				
			}else{
				
				if($.trim( $(this).val() ) == ''){
					check = false;
					target = $(this).prop('title');
					type = 'blank';
					$(this).focus();
				}
				
			}
			
			
		}
	})
	
	
	if(!check){
		var msg = '';
		if(type == 'blank'){
			msg = '해당 값은 필수 입력값입니다 - ['+ target + ']'; 
		}
		
		alert(msg);
	}
	
	return check;
	
}

//본인인증 간편화/////////////////////////

function authMySelfScript(type, parent){
	authMySelf(type , 'script', parent);
}


function authMySelfBasic(type){
	authMySelf(type , '', '0');
}

function authMySelf(type ,  endUrl, parent){

	
	if($('form[name="authF"]').length == 0){
		
		var html = "<form name='authF' action='"+ sub +"/mbr/auth_step1.do' method='post'>";
		html += '<input type="hidden" name="type" value="'+ type +'" />';
		html += '<input type="hidden" name="parent" value="'+ parent +'" />';
		
		if(endUrl != ''){
			html += '<input type="hidden" name="targetUrl" value="'+ endUrl +'" />';
		}
		
		html += '<input type="hidden" name="_csrf" value="'+ csTkn +'" />';
		html += '</form>';
		$('body').append(html);
		
	} else {
		$('form[name="authF"]').find('input[name="type"]').val(type);
		$('form[name="authF"]').find('input[name="parent"]').val(parent);
		$('form[name="authF"]').find('input[name="targetUrl"]').val(endUrl);
		$('form[name="authF"]').find('input[name="_csrf"]').val(csTkn);
	}
	
	window.open("", "phone_auth_popup", "width=430, height=640, scrollbar=yes");
	
	var target = $('form[name="authF"]');
	target.prop('target' , 'phone_auth_popup');
	setTimeout(function() {
		target.submit();	
	}, 500);
	
	
}

//본인인증 간편화 ENd//////////////////////////////////

// 나이스 본인인증 
function fnAuthNiceWeb(parent) {
    $.ajax({
        url : sub + '/api/mbr/getNiceAuthUrl.do',
        type : 'POST',
        data : {
            'parent' : parent
        },
        success : function(result){
            var rst = result.data;
            if(rst.code == "success"){
                window.open(
                        rst.urlInfo.popupUrl,
                        'authNiceWeb', 'width=480, height=812,top=100,fullscreen=no,menubar=no,status=no,titlebar=yes,location=no,toolbar=no,scrollbar=no');
            } else {
                openAlertPopup('인증 요청에 실패했습니다.');
                authPopup.close();
            }
        },
        beforeSend : function(xhr){   
            xhr.setRequestHeader(csTknH, csTkn);
        },
        error : function(row){
            openAlertPopup('오류로 인해 확인할 수 없습니다.\n잠시 후 다시 시도해 주세요.');
            authPopup.close();
            console.log("code: " + request.status)
            console.log("message: " + request.responseText)
            console.log("error: " + error);
        }
    })
}


function openBlank(url){
	window.open(url , '' );
}

// 2023-11-22 웹접근성 때문에 추가 bk

//사용자 알림 show hide
function showAlert(targetId , msg ,type){
	var msgTarget = $('#' + targetId); 
	msgTarget.html(msg);
	if(type == "s"){
		msgTarget.removeClass("fail").addClass("success");
	}else{
		msgTarget.removeClass("success").addClass("fail");
	}
}



//사용자 컨펌 show (접근성)
/**
 * 
 * @param title - 제목
 * @param msg - 메세지
 * @param buttonTarget - 취소 클릭시 돌아갈 포커스 대상(접근성 필수)
 * @param func - 확인버튼 클릭 시 동작
 * @returns
 */
function showConfirm(title, msg , buttonTarget , func ){
	
	$('.layer_pop h4').html(title);
	$('.layer_pop p').html(msg);
	beforeFocus = buttonTarget;
	
	$('.layer_pop .pop_confirm').unbind('click').click(func);
	$('.layer_pop .pop_con').attr('aria-labelledby' , title + " " + msg);
	$('.layer_pop').show().focus();
	$('.layer_pop .pop_con').focus()
	
	
}

function comma(val) {
    var tmp = val.split('.');
    var minus = false;
    var str = new Array();

    if(tmp[0].indexOf('-') >= 0) {
        minus = true;
        tmp[0] = tmp[0].substring(1, tmp[0].length);
    }

    var v = tmp[0].replace(/,/gi,'');
    for(var i=0; i<=v.length; i++) {
        str[str.length] = v.charAt(v.length-i);
        if(i%3==0 && i!=0 && i!=v.length) {
            str[str.length] = '.';
        }
    }
    str = str.reverse().join('').replace(/\./gi,',');
    if(minus) str = '-' + str;

    return (tmp.length==2) ? str + '.' + tmp[1] : str;
}




//lightbox
$(document).ready(function(){
	$('a[data-lightbox]').magnify({
		   draggable: false,
           initMaximized : true
	});
})
//lightbox End


//preloader
/*
*preloader 제외
$(document).ready(function(){
	$(document).on('click' , 'a' , function(){
		if($(this).hasClass('noLoad')){
			$('body').addClass('noLoad');
		}
	})
})


$(window).on('beforeunload', function() {
	if(!$('body').hasClass('noLoad')) $('body').preloader();
}); 


$(window).on('pageshow', function(event) {
  if (event.originalEvent.persisted) {
  	$('.preloader').remove();
  	$('body').removeClass('noLoad');
  }
});

*/

//preload End



//file upload refactoring

$(document).ready(function(){
	$('.file_advance .fileBtn').click(function(){
		$(this).closest('div').find('input[type="file"]').click();
	})
	
	$('.file_advance input[type="file"]').bind('change' , function(){
		$(this).closest('div').find('input[name="placeFileName"]').val( $(this).val() );
	})
})

function file_del(obj, parent ,idx , code , slt){
	if(confirm("정말로 삭제하시겠습니까?\n한번 삭제하신 파일은 복구가 불가능합니다.")){
		
		$.ajax({
			url :  sub + '/api/fileDel.do',
			type : 'POST',
			data : {
				parent : parent,
				idx : idx,
				code : code,
				salt : slt
			},
			success : function(row){
				if(row.data.result == "ok"){
					alert("정상적으로 삭제되었습니다.");
					
					var parent = $(obj).closest('td, li');
					parent.find('.downDiv').remove();
					parent.find('.file').show();
				}else{
					alert('에러가 발생하여 처리하지못하였습니다.')
				}
			},
			error : function(data){
				
				if(typeof data.responseJSON.error === undefined ){
					alert('에러가 발생하여 처리하지못하였습니다.')
				}else{
					alert(data.responseJSON.error);	
				}
			}
		})
	}
}

//file upload refactoring End

/**
 * 코드값을 이용한 select 변환
 * @param groupName - group값
 * @param targetName - 대상 selectName
 * @param type - idx | group
 * @param prefix - idx의 경우 group에 붙일 prefix가있을경우 이용, 없으면 ''
 * @returns
 */
function SelectChange_for_code(groupName , targetName , type , prefix){
	
	$.ajax({
		url : sub + '/ajax/get_code_list.do',
		data : {
			'group' : groupName,
			'type' : type,
			'prefix' : prefix
		},
		success : function(rst){
			try{
				
				if(rst.data.code == ST.SUCCESS){
					const target = $('select[name="'+ targetName +'"]') 
					target.html("");
					
					const list = rst.data.list;
					
					for(let key in list){
						if (list.hasOwnProperty(key)) {
							const option = $('<option>' , { value : key }).text(list[key])
							target.append(option);
						}
					}
					
				}else{
					alert('에러가 발생하여 값을 불러오는데 실패하였습니다.');
				}
				
				
			}catch(e){
				console.log(e);
				alert('에러가 발생하여 값을 불러오는데 실패하였습니다.');
			}
		},
		error : function(e){
			console.log(e);
			alert('에러가 발생하여 값을 불러오는데 실패하였습니다.');
		}
	})
	
}


/**
 * 입력값이 ip 형식인지 체크한다
 */
function isValidationIp(ip){
	var ipFormat = /^([0-9]{1,3}\.){3}[0-9]{1,3}$/;
	
	if (ip.match(ipFormat)) {
        // 각 부분의 범위가 올바른지 확인
        var ipParts = ip.split('.');
        for (var i = 0; i < ipParts.length; i++) {
            var part = parseInt(ipParts[i]);
            if (part < 0 || part > 255) {
                return false;
            }
        }
        return true;
    } else {
        return false;
    }
}

function xssFilter(str){
	var rst = '';
	rst = str.replace(/[&<>"']/g, function(match) {
        switch(match) {
            case '&':
                return '&amp;';
            case '<':
                return '&lt;';
            case '>':
                return '&gt;';
            case '"':
                return '&quot;';
            case "'":
                return '&#x27;'; // Single quote
            default:
                return match;
        }
    });
	
	return rst;
}

/**
 * 알럿 레이어팝업
 * @param message
 * @param callback
 */
function openAlertPopup(message, callback) {
    $('input[type="text"]').blur();
    const $popup = $('#commonAlert');

    $popup.find('.modal-header h2').text(message);     // 메시지 세팅

    // 이전 이벤트 제거
    $popup.find('.close-modal').off('click');

    // 확인 버튼 클릭
    $popup.find('.close-modal').on('click', function (e) {
        e.preventDefault();
        $popup.removeClass('in shown');
        $popup.find('.modal-back').removeClass('in');

        if (typeof callback === 'function') {
            callback();
        }
    });

    $popup.addClass('in shown');
    $popup.find('.modal-back').addClass('in');
}
