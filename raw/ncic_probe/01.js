$(document).ready(function(){
	
	
		$('select[name="stYear"]').change(function(){
			//renderAll();
			resetTab();
			reset_list();
			//loadInventory(1);
		});
		
 		if(typeof type !== 'undefined' && (type == 'wld' || type == 'wldorg')){
 			checkboxLevel = 2;
 			orgType = 'wld';
 			tableType = 'tableType3';
 			$('.compar-wrap').hide();
 			$('.wishList').hide();
 			$('.search-eduBtn .krds-btn.tertiary').hide();
 			$('.dtTree').addClass('hidden');
 			$('.edu-list-top').addClass('wld_top');
 		}
 		

 		
 		//메뉴탭 클릭
 		$('.menuTab [role="tab"] .btn-tab').off().on('click', function() {
			// 현재 클릭된 버튼의 상위 li 요소
			const $thisTab = $(this).closest('[role="tab"]');
			const targetId = $thisTab.attr('aria-controls');

			if(!$thisTab.hasClass('active')){
				
				if(type == 'wld' || type == 'wldorg'){
					if(targetId == "panel_edu_01"){
						window.location.href = sub + '/inv/wldorg/list.do';
					}else{
						window.location.href = sub + '/inv/wld/list.do';
					}
					
				}else{
					
					if(targetId == "panel_edu_01"){
						
						nowPage = "원문인벤토리";
						nowTblType = "org";
						checkboxLevel = 3;
						tableType = 'tableType1';
						
						$('.dtTree_tab').show();
						$('.dtTree_tab').removeClass('hide');
						$('.dtTree').removeClass('hidden');
						$('.category').show();
						$('.download_btm').hide();
						
						$('.wishList').show();    // 즐겨찾기
                        $('.compar-wrap').show();    // 선택항목 비교보기
                        
                        $('#panel_edu_01 .side_title_area').text("원문 인벤토리 목록"); // 모바일 메뉴 타이틀
						
					}else if(targetId == "panel_edu_02"){ 
						nowPage = "표준인벤토리";
						nowTblType = "std";
						checkboxLevel = 2;
						tableType = 'tableType1';
						printYear('1000');
						
						$('.dtTree_tab').hide();
						$('.dtTree_tab').addClass('hide');
						$('.dtTree').addClass('hidden');
						$('.category').show();
						$('.download_btm').hide();
						
						$('.wishList').show();    // 즐겨찾기
                        $('.compar-wrap').show();    // 선택항목 비교보기
                        
                        $('#panel_edu_01 .side_title_area').text("표준 인벤토리 목록"); // 모바일 메뉴 타이틀
						
					}else{
						nowPage = "원문 및 해설서";
						nowTblType = "dwn";
						checkboxLevel = 2;
						tableType = 'tableType2';
						
						$('.dtTree_tab').hide();
						$('.dtTree_tab').addClass('hide');
						$('.dtTree').addClass('hidden');
						$('.category').hide();
						$('.download_btm').show();
						
						$('.wishList').hide();    // 즐겨찾기
                        $('.compar-wrap').hide();    // 선택항목 비교보기
                        
                        $('#panel_edu_01 .side_title_area').text("원문 및 해설서 목록"); // 모바일 메뉴 타이틀
					}
					
					reset_list();
					
					// 1. 모든 탭 비활성화
					$('[role="tab"]').removeClass('active').attr('aria-selected', 'false');
					$('[role="tab"] .created').remove(); // 기존 선택됨 텍스트 제거
					
					// 2. 클릭된 탭 활성화
					$thisTab.addClass('active').attr('aria-selected', 'true');
					$(this).append('<i class="sr-only created"> 선택됨</i>'); // 선택됨 텍스트 추가
					
					$('.category li.active').removeClass('active');
					$('.category li:eq(0)').click();
					
					$('.krds-table-wrap').hide();
					$('#' + tableType).show();
					
				}
				
			}

		});
 		
 		//시대별 카테고리 선택
 		$('.category li').click(function(e){
 			
 			e.preventDefault();
 			if(!$(this).hasClass('active')){
 				const idx = $('.category li').index($(this));
 				
 				if(typeof type !== 'undefined' && (type == "wld" || type == "wldorg")){ //세계 교육과정
 					
 					
 					const myRegion = $(this).data('region');
 					$('.swiper-region.active').removeClass('active');
 					$('.swiper-region[data-region="'+ myRegion +'"]').addClass('active');
 					
 					swiperInstances[idx].update();
 					swiperInstances[idx].navigation.update();
 					
 					setInitRegion();
 					
 				}else{
 					
 					if(idx == 0){
 	 	 				orgType = 'ogi4'
 	 	 			}else if(idx == 1){
 	 	 				orgType = 'ogi3'
 	 	 			}else if(idx == 2){
 	 	 				orgType = 'ogi2'
 	 	 			}else if(idx == 3){
 	 	 				orgType = 'ogi1'
 	 	 			}
 	 	 			
 	 	 			
 	 	 			resetTab();
 	 	 			reset_list();  // 리스트 초기화 2025-09-29 ea
 	 	 			
 				}
 				
 				$('.category li.active').removeClass('active');
	 	 		$(this).addClass('active');
 				
 	 			
 			}
 			
 		})
 		
 		//탭 카테고리 선택
 		$('.dtTree_tab li').click(function (e) {
 	        e.preventDefault();
 	        
 	        if(!$(this).hasClass('on')){
 	        	 const current = $(this).attr('data-tab');
 				const idx = $('.dtTree_tab li').index($(this));
 	 	        
 	 	        $('.dtTree_tab li').removeClass('on');
 	 	        $('.dtTab').removeClass('on');

 	 	        $(this).addClass('on');
 	 	        $('#' + current).addClass('on');
 	 	        loadInventory( (parseInt(idx) + 1) )
 	        }
 	       
 	    });
 	    
	/* 다운로드 모달 */ 
    $(document).on('click', '.open-modal', function(e){
    	open_down_modal($(this));
    }).on('click', '.open-tr', function(e){
        open_down_tr($(this));
    }).on('click', 'input[name="chk_all"]', function(){
    	var chk_cnt = $(this).closest('table').find('input[name="chk"]:not(:checked)').length;
    	if((selectRow.length + chk_cnt) > 20){
    		alert('최대 20개까지 선택하실 수 있습니다.');
    		$(this).prop('checked', false);
    	} else {
// 			$(this).closest('table').find('input[name="chk"]').prop('checked', $(this).prop('checked'));
			//선택되는 항목들을 비교하기에 추가
			if($(this).prop('checked')){
				$(this).closest('table').find('input[name="chk"]').each(function(){
					if(!$(this).prop('checked')){		//기존에 체크된것들은 제외하고 추가하기 위한 조건
						$(this).prop('checked', true);
						var num = ($(this).prop('id').replace('chk_', '')*1)-1;
						var row = boardData[num];
						
						var flag = true;
						for(var i=0; i<selectRow.length; i++){
							if(selectRow[i].seq == row.seq){
								flag = false;
							}
						}
						
						if(flag){
							selectRow.push(row);
							var html = "";
							html += "<li>";
							html += "<input type='hidden' name='seqInfo' value='"+row.seq+"' />";
							html += "    <p class=\"tit\">"+row.location+" > "+row.title+"</p>";
							html += "      <button type=\"button\" class=\"krds-btn large icon border\" onclick=\"del_row('"+row.seq+"')\"> <span class=\"sr-only\">삭제</span><i class=\"svg-icon ico-del\"></i></button>";
							html += "</li>";
							
							$('.compar-body > .compar-list > li:last-child').before(html);
						}
					}
				});
			} else {
				$(this).closest('table').find('input[name="chk"]').each(function(){
					$(this).prop('checked', false);

					//취소된 항목들을 비교하기에서 제외 한다
					var num = ($(this).prop('id').replace('chk_', '')*1)-1;
					var row = boardData[num];
					for(var i=0; i<selectRow.length; i++){
						if(selectRow[i].seq == row.seq){
							selectRow.splice(i, 1);
							$('.compar-body > .compar-list > li').each(function(){
								if($(this).find('input[name="seqInfo"]').val() == row.seq){
									$(this).remove();
								}
							});
							$('input[name="chk"]').each(function(){
								if($(this).val() == row.seq){
									$(this).prop('checked', false);
								}
							});
						}
					}
				});
			}
    	}
	}).on('change', 'input[name="chk"]', function(e){
		var num = ($(this).prop('id').replace('chk_', '')*1)-1;
		var row = boardData[num];
		
		if($(this).prop('checked')){
			if(selectRow.length >= 20){
				alert('최대 20개까지 선택하실 수 있습니다.');
				$(this).prop('checked', false);
			} else {
				var flag = true;
				for(var i=0; i<selectRow.length; i++){
					if(selectRow[i].seq == row.seq){
						flag = false;
					}
				}
				
				if(flag){
					selectRow.push(row);
					var html = "";
					html += "<li>";
					html += "<input type='hidden' name='seqInfo' value='"+row.seq+"' />";
					html += "    <p class=\"tit\">"+row.location+" > "+row.title+"</p>";
					html += "      <button type=\"button\" class=\"krds-btn large icon border\" onclick=\"del_row('"+row.seq+"')\"> <span class=\"sr-only\">삭제</span><i class=\"svg-icon ico-del\"></i></button>";
					html += "</li>";
					
					$('.compar-body > .compar-list > li:last-child').before(html);
				}
				
				// 모두 선택되면 전체 선택 체크박스 체크
				var total = $('input[name="chk"]').length;
				var checked = $('input[name="chk"]:checked').length;
				$('input[name="chk_all"]').prop('checked', total === checked);
				
			}
		} else {
			for(var i=0; i<selectRow.length; i++){
				if(selectRow[i].seq == row.seq){
					selectRow.splice(i, 1);
					$('.compar-body > .compar-list > li').each(function(){
						if($(this).find('input[name="seqInfo"]').val() == row.seq){
							$(this).remove();
						}
					});
					$('input[name="chk"]').each(function(){
						if($(this).val() == row.seq){
							$(this).prop('checked', false);
						}
					});
				}
			}
			
			// 전체선택 해제
			if($(this).closest('table').find('input[name="chk_all"]:checked').length > 0) {
                $(this).closest('table').find('input[name="chk_all"]:checked').prop('checked', false);
            }
		}
		console.log(selectRow)
	});


    //팝업 닫기버튼
	const closeButton = `
        <button class="inv_view_close">
            <i class="xi-close"></i>
        </button>
    `;
    
    // 원하는 위치에 추가하기
    // 예: div#container 안에 추가
    $('#popEduInfo .popCont').append(closeButton);
    
	$('.inv_view_close').click(function(){
		$('#popEduInfo').removeClass('open');
	});
	
	
	/* 비교하기 더보기 */
    $('.comparBtn').click(function () {
        var $body = $('.compar-body');
        var $srText = $(this).find('.sr-only');
        var isOpen = $body.is(':visible');

        if (isOpen) {
          $body.slideUp(); // 위에서 접기
          $srText.text('열기'); // 텍스트 원복
          $(this).find('.ico-angle').removeClass('up').addClass('down');
          $('.compar-wrap').removeClass('open');
        } else {
          $body.slideDown(); // 아래로 펼치기
          $srText.text('닫기'); // 텍스트 변경
          $(this).find('.ico-angle').removeClass('down').addClass('up');
          $('.compar-wrap').addClass('open');
        }
    });
	
    
	
	/* 비교하기 팝업 안에 슬라이드 순서 변경 */
	const swiper = new Swiper(".compar-slide", {
	  slidesPerView: 3,
	  spaceBetween: 30,
	  freeMode: true,
	  slideToClickedSlide: true,
	  allowTouchMove: false,
	  observer: true,            // 탭 안에서 동작
	  observeParents: true,
	  navigation: {
	    nextEl: ".comp_next",
	    prevEl: ".comp_prev",
	  },
	  nested: true,
	  pagination: {
	    el: ".swiper-pagination",
	    clickable: true,
	  },
	  breakpoints: {
	    0: {
	      slidesPerView: 1,
	      grid: {
	        rows: 1,
	      },
	      slidesPerGroup: 1,
	      spaceBetween: 20,
	    },
	    768: {
	      slidesPerView: 1,
	      freeMode: false,
	      allowTouchMove: true,  
	      grid: {
	        rows: 1,
	      },
	      slidesPerGroup: 1,
	      spaceBetween: 20,
	    },
	    1024: {
	      slidesPerView: 1,
	      freeMode: false,
	      allowTouchMove: true,
	      grid: {
	        rows: 1,
	        fill: 'row', // 'row' 또는 'column' 가능
	      },
	      slidesPerGroup: 1,
	      spaceBetween: 30,
	    },
	    1440: {
	      slidesPerView: 2,
	      grid: {
	        rows: 1,
	      },
	      slidesPerGroup: 1,
	      spaceBetween: 30,
	    }
	  }
	});

	$("#sortable-slides").sortable({
         update: function (event, ui) {
             $("#sortable-slides").not($(this)).html($(this).html());
         }
	}).disableSelection();
	
	$('.comparPop').click(function () {
    	$('#popCompar').addClass('open');
    	$('body').addClass('scroll-no');
    });
    
    $('#popCompar .btn-close').click(function () {
    	$('#popCompar').removeClass('open');
    	$('body').removeClass('scroll-no');
    	$('.content_body').show();
    });
    
    //즐겨찾는 교육과정 셀렉트박스 커스텀
    const $dropdown = $('#dropbox');
    const $selectBox = $dropdown.find('select.krds-form-select');
    const $selection = $('#selected_title');
    const $dropList = $dropdown.find('.list-items');

    $dropdown.on('click', function (e) {
      const $target = $(e.target);

      // 토글 드롭다운
      $dropList.toggleClass('open');

      // li 클릭 시 처리
      if ($target.is('li') && $target.data('value')) {
        const value = $target.data('value');
        const text = $target.text();

        $selectBox.val(value);
        $selection.html(text);

        // active 클래스 갱신
        $dropList.find('li').removeClass('active');
        $target.addClass('active');
      }
    });
	
    $('.filter-btn').click(function(){
    	$('.edu-between-conts .aside').toggleClass('on');
    	$('body').toggleClass('scroll-no');
    });
    $('.filter_close').click(function(){
    	$('.edu-between-conts .aside').removeClass('on');
    	$('body').removeClass('scroll-no');
    });
    
    
    // 북마크
    $(document).on('click' , '.bookmark' , function(){
        
        if(nowTblType == 'dwn') {   // 원문 및 해설서
        
            var degreeCode = $(this).closest('tr').data('degreecode');
            var classCode = $(this).closest('tr').data('classcode');
            var openYear = $(this).closest('tr').data('openyear');
            var openMonth = $(this).closest('tr').data('openmonth');
            var subjectCode = $(this).closest('tr').data('subjectcode');
        
            $.ajax({
                url:'/api/inv/bookmark_change.do',
                type:'post',
                dataType:'json',
                data:{
                    'degreeCode': degreeCode,
                    'classCode': classCode,
                    'openYear': openYear,
                    'openMonth': openMonth,
                    'subjectCode': subjectCode,
                    'orgType': orgType,
                    'tblType': commonData.nowTblType,
                    'menuType': commonData.menuType
                },
                success : function(rst) {
                    const result = rst.data;
                    if(result.code == 'success'){
                        if(result.status == 'on'){
                            $('tr[data-degreecode="'+degreeCode+'"][data-classcode="'+classCode+'"][data-openyear="'+openYear+'"][data-openmonth="'+openMonth+'"][data-subjectcode="'+subjectCode+'"]')
                                .find('.bookmark span').addClass('on');  
                            openAlertPopup('즐겨찾는 교육과정 목록에 추가되었습니다.\n마이페이지 > 즐겨찾는 교육과정 내역 에서 확인하실 수 있습니다.');
                        }else{
                            $('tr[data-degreecode="'+degreeCode+'"][data-classcode="'+classCode+'"][data-openyear="'+openYear+'"][data-openmonth="'+openMonth+'"][data-subjectcode="'+subjectCode+'"]')
                                .find('.bookmark span').removeClass('on');
                        }
                    } else {
                        $('tr[data-degreecode="'+degreeCode+'"][data-classcode="'+classCode+'"][data-openyear="'+openYear+'"][data-openmonth="'+openMonth+'"][data-subjectcode="'+subjectCode+'"]')
                            .find('.bookmark span').removeClass('on');
                        openAlertPopup(result.msg);
                    }
                },
                error : function(e){
                    handleAjaxError(e);
                }
            });
            
        } else {
            let selYear = $('select[name="stYear"] option:selected').val();
            var rootIdx = $(this).closest('tr').data('seq');
        
            if(rootIdx == null || rootIdx == '') {
                alert('정상적이지 않은 접근입니다.');
                return false;
            }
            
            $.ajax({
                url:'/api/inv/bookmark_change.do',
                type:'post',
                dataType:'json',
                data:{
                    'rootIdx': rootIdx,
                    'orgType': orgType,
                    'openYear': selYear,
                    'tblType': commonData.nowTblType,
                    'menuType': commonData.menuType
                },
                success : function(rst) {
                    const result = rst.data;
                    if(result.code == 'success'){
                        if(result.status == 'on'){
                            $('tr[data-seq="'+rootIdx+'"]').find('.bookmark span').addClass('on');  
                            openAlertPopup('즐겨찾는 교육과정 목록에 추가되었습니다.\n마이페이지 > 즐겨찾는 교육과정 내역 에서 확인하실 수 있습니다.');
                        }else{
                            $('tr[data-seq="'+rootIdx+'"]').find('.bookmark span').removeClass('on');
                        }
                    } else {
                        $('tr[data-seq="'+rootIdx+'"]').find('.bookmark span').removeClass('on');
                        openAlertPopup(result.msg);
                    }
                },
                error : function(e){
                    handleAjaxError(e);
                }
            });
        }
    })
    /*
    $(window).on('load', function () {
        var hash = window.location.hash;
        if(hash) {
            if(hash == "#tab_edu_01") {
                $('.menuTab [role="tab"]').eq(1).find('.btn-tab').off().trigger('click');
            } else if(hash == "#tab_edu_02") {
                $('.menuTab [role="tab"]').eq(2).find('.btn-tab').off().trigger('click');
            }
        }
    });
    */
   
   
	$(window).on('load', function () {
		let ck = $('input[name="ck"]').val();
 		if(ck == 'main'){
		    nowPage 		= "원문인벤토리";
		    nowTblType 		= "org";
		    checkboxLevel 	= 3;
		    tableType 		= 'tableType1';
		
		    $('.dtTree_tab').show().removeClass('hide');
		    $('.dtTree').removeClass('hidden');
		    $('.category').show();
		    $('.download_btm').hide();
		
		    $('.wishList').show();
		    $('.compar-wrap').show();
		
		    const $targetTab = $('#tab_edu_01');
		
		    $('[role="tab"]').removeClass('active').attr('aria-selected', 'false');
		    $('[role="tab"] .created').remove();
		
		    $targetTab
		        .addClass('active')
		        .attr('aria-selected', 'true')
		        .find('.btn-tab')
		        .append('<i class="sr-only created"> 선택됨</i>');
		
		    reset_list();
		    $('.category li.active').removeClass('active');
		    $('.category li:eq(0)').click();
		
		    $('.krds-table-wrap').hide();
		    $('#tableType1').show();
    	}
    });
    
});

//인벤토리 로드 관련

 	function resetTab(){
 		
 		for (let i = 1; i <= 3; i++) {
 		    const $tree = $('#dtreeHTML' + i);
 		    const tree = $.ui.fancytree.getTree($tree);

 		    if (tree) {
 		        $tree.fancytree("destroy").empty();
 		    }
 		}
 		$('.dtTree_tab li.on').removeClass('on');
 		$('.dtTree_tab li:eq(0)').click();
 		setLocation();
 		
 	}
 	
 	
 	/**
 	* step - 1(시대/차수별) 2(학교별) 3(영역/교과목별)
 	*/
 	async function loadInventory(step){
		
 		mainTitle 	= '';
 		nationCode 	= ''; // 2025-08-20 추가
 		target = 'dtreeHTML' + step;
 		
 		$('select[name="stYear"]').hide();
 		if(nowTblType != 'dwn'){
 			switch(orgType){
	 			case 'ogi1':
	 				mainTitle = '조선시대'
	 				break;
	 			case 'ogi2':
	 				mainTitle = '개화기'
	 				break;
	 			case 'ogi3':
	 				mainTitle = '일제강점기'
	 				break;
	 			case 'ogi4':
	 				mainTitle = '1945년 이후'
	 				break;
	 					
	 		}
	 		orgName = mainTitle;
 		}
 		
 		if(nowTblType == 'org'){
 			mainTitle += ' 원문 인벤토리';

 	 		if(step == '1'){
 	 			mainTitle += '(시대/차수별)'
 	 		}else if(step == '2'){
 	 			mainTitle += '(학교별)'
 	 		}else if(step == '3'){
 	 			mainTitle += '(영역/교과목별)'
 	 		}
 			
 		}else if(nowTblType == 'std'){
 			mainTitle += ' 표준 인벤토리';
 			if(orgType == 'ogi4'){	//표준의 1945년 이후에만 년도를 표기한다
	 			$('select[name="stYear"]').show();
	 			nationCode = '1000';
	 		}
	 		
 		}else if(nowTblType == 'wld'){
            nationCode = $(".oversea_docs_swiper.nationListArea.active .swiper-slide.on").attr("data-nationcd");
            
            var nationNm = $(".oversea_docs_swiper.nationListArea.active .swiper-slide.on h5").contents().get(0).nodeValue.trim();
            mainTitle += nationNm + ' 표준 인벤토리';
            $('select[name="stYear"]').show();
            
        }else if(nowTblType == 'dwn'){
 			mainTitle += '교육과정 원문 및 해설서';
 		}
		
 		
 		if($( '#' + target).find('.ui-fancytree').length == 0){
			
			await fn_chagne_briefing(orgType, nowTblType, '1000'); // 여기서 간략정보 비동기 처리
			await fn_chagne_bookmark(orgType, nowTblType, '1000'); // 여기서 즐겨찾기 비동기 처리
			$('#selected_title').text("즐겨찾는 교육과정");
 			InventoryTree({
 				orgType : orgType,
 				treeDepth : 1,
 				inDiv : target,
 				nowTblType : nowTblType,
 				menuType : step,
 				printType : 'web',
 				nationCode : nationCode
 			})	
 			
 		} else {
            commonData.menuType = step;
        }
 		
 	}
 	
 	function setLocation(){
 		$('#panel_edu_01 > .sr-only').html(nowPage + " > " + orgName );
 	}
 	
 	
 	//세계교육과정 전용
 	function setInitRegion(){
 		const myRegion = $('.catelist li.active').data('region');
 		$('.swiper-region.active .swiper-slide.on').removeClass('on');
 		const target = $('.swiper-region.active .swiper-slide:eq(0)');
 		//const region = target.data('region');
 		const code = target.data('nationcd');
 		searchWorldMap(code);
 	}
 	
 	function searchWorldMap(code){
 		
 		//let target = $('.swiper-region.active .swiper-slide[data-region="'+ code +'"]');
 		let target = $('.swiper-region.active .swiper-slide[data-nationcd="'+ code +'"]');
 		if(!target.hasClass('on')){
 			for (let i = 1; i <= 3; i++) {
 	 		    const $tree = $('#dtreeHTML' + i);
 	 		    const tree = $.ui.fancytree.getTree($tree);

 	 		    if (tree) {
 	 		        $tree.fancytree("destroy").empty();
 	 		    }
 	 		}
 	 		
 			$('.swiper-region.active .swiper-slide.on').removeClass('on');
 			target.addClass('on');

 			const nationNameEl = target.find('h5');
 			nowNation = nationNameEl.html().replace(/<span[^>]*>.*?<\/span>/gi, '').trim(); 
 			nowNationCode = target.data('code');
 			
 			mainTitle = nowNation;
 			if(type == "wld"){
 				mainTitle += " 표준 인벤토리";
 				$('.dtTree_tab').hide();
				$('.dtTree_tab').addClass('hide');
 				$('select[name="stYear"]').show();
                printYear(code);
 			}else{
				$('.dtTree_tab').hide();
				$('.dtTree_tab').addClass('hide');
 				mainTitle += " 원문 인벤토리";
 				
 				$('select[name="stYear"]').hide();
 			}
 			
 			InventoryTree({
 				orgType : orgType,
 				treeDepth : 1,
 				nowTblType : nowTblType,
 				inDiv : 'dtreeHTML1',
 				menuType : 1,
 				printType : 'web',
 				nationCode : code,
 				nationNumber : nowNationCode
 			})	
 		}
 	}

//인벤토리 로드 End



function move_view(type, year, location, seq){
	
	var w = window.screen.width;
    var h = window.screen.height;
    window.open('', 'inv_view', 'width=' + w + ',height=' + h + ',top=0,left=0,scrollbars=yes,resizable=yes');
	
	if(type == 'std'){ // 우리나라 표준인벤토리일 경우
	   if(commonData.type == 'ogi4') {  // 우리나라 1945년 이후만 년도 선택
           let selYear = $('select[name="stYear"] option:selected').val();
           $('form[name="view_form"]').find('input[name="openYear"]').val(selYear);
       }
	   $('form[name="view_form"]').find('input[name="nationCd"]').val("1000");
	   
	}else{
        if(commonData.type == 'wld') {  // 세계교육과정 표준인벤토리
           let selYear = $('select[name="stYear"] option:selected').val();
           $('form[name="view_form"]').find('input[name="openYear"]').val(selYear);
        } else {
           $('form[name="view_form"]').find('input[name="openYear"]').val(year);
        }
		$('form[name="view_form"]').find('input[name="nationCd"]').val(commonData.nationCode);   
	}
	
	$('form[name="view_form"]').attr('action', '/inv/' + type + '/view.do');
	$('form[name="view_form"]').find('input[name="orgType"]').val(commonData.type);
	$('form[name="view_form"]').find('input[name="menuType"]').val(commonData.menuType);
	$('form[name="view_form"]').find('input[name="location"]').val(location);
	$('form[name="view_form"]').find('input[name="seq"]').val(seq);
	$('form[name="view_form"]').submit();
}
 
function open_down_modal(obj){
	$('.down-modal').removeClass('in');
	
	const seq = obj.closest('tr').data('seq');
	const openYr = obj.closest('tr').find('input[name="invYear"]').val();
	
	const parent = obj.closest('div.download-wrap');
	const btnOffset = obj.offset();
	const parentOffset = parent.offset();
	const popupTop = btnOffset.top - parentOffset.top;
	
	let top = Math.ceil(popupTop + (obj.outerHeight()/2));
	
	// 원문 및 해설서
	const degreeCode = obj.closest('tr').data('degreecode');
	const classCode = obj.closest('tr').data('classcode');
	const openYear = obj.closest('tr').data('openyear');
	const openMonth = obj.closest('tr').data('openmonth');
	const subjectCode = obj.closest('tr').data('subjectcode');
	
	// 세계교육과정
	const nationCode = obj.closest('tr').data('nationcode');
	
	// 전체 다운로드 위해 추가
    $('form[name="total_down_form"] input[name="year"]').val(openYear);
    $('form[name="total_down_form"] input[name="degree"]').val(degreeCode);
    $('form[name="total_down_form"] input[name="cls"]').val(classCode);
    $('form[name="total_down_form"] input[name="subject"]').val(subjectCode);
    $('form[name="total_down_form"] input[name="nationCd"]').val(nationCode);
    $('form[name="total_down_form"] input[name="mon"]').val(openMonth);
    $('form[name="total_down_form"] input[name="orgType"]').val(commonData.type);
    $('form[name="total_down_form"] input[name="tblType"]').val(commonData.nowTblType);
	
	/*
	* 레이어가 부모 div범위를 벗어나면 위로 올려주는 코드.
	const layerPopup = $('.down-modal');
	const parentHeight = parent.innerHeight();
	 
	if(top + layerPopup.outerHeight() > parent.innerHeight()){
		top = Math.ceil(popupTop - layerPopup.outerHeight());
		if(top < 0){
			top = Math.ceil(popupTop + (obj.outerHeight()/2));
		}
	}
	*/
	
	$.ajax({
		url:'/api/inv/invFileList.do',
		type:'post',
		dataType:'json',
		data:{
            'invSeq':seq, 
            'invYear':openYr,
            'orgType':commonData.type,
            'degreeCode':degreeCode, 
            'classCode':classCode, 
            'openYear':openYear, 
            'openMonth':openMonth, 
            'subjectCode':subjectCode,
            'nationCode':nationCode,
            'type': commonData.nowTblType
        },
		success:function(data){
			$('.upload-list').empty();
			
			var list = "";
			
			if(data.data.invFiles.length > 0){
				for(var i=0; i<data.data.invFiles.length; i++){
					var row = data.data.invFiles[i];
					
					
					list += '<li>';
					list += '<div class="file-info m-column">';
	                list += '<div class="file-name"><i class="svg-icon file_' + row.fileExt.toLowerCase() + '"></i> '+row.fileOrg+'</div>';
	                if(row.nationCode == '1000' || row.nationCode == null){
	                	list += '<button type="button" class="krds-btn medium text" onclick="down_file(\''+row.orgAttNo+'\', \''+row.openYear+'\')">다운로드 <i class="svg-icon ico-down"></i></button>';
	                } else {
						list += '<button type="button" class="krds-btn medium text" onclick="down_wld_file(\''+row.orgAttNo+'\', \''+row.openYear+'\')">다운로드 <i class="svg-icon ico-down"></i></button>';
					}
	            	list += '</div></li>';
				}
				
				$('.upload-list').append(list);
				$('.down-modal').css({top:top+'px'});
				$('.down-modal').toggleClass('in');
				
			} else {
				alert('첨부파일이 없습니다.');
			}
		}
	});

}

function open_down_tr(obj){
    const $tr = obj.closest("tr");
    
    // 이미 열려있는 drop-tr 이 현재 tr 바로 뒤에 있으면 -> 닫기
    if ($tr.next().hasClass("drop-tr")) {
        $tr.next(".drop-tr").remove();
        return;
    }
    
    $('.drop-tr').remove();     // 현재 tr 제거
    
    const seq = obj.closest('tr').data('seq');
    const openYr = obj.closest('tr').find('input[name="invYear"]').val();
    const nationCode = obj.closest('tr').data('nationcode');
    const classCode = obj.closest('tr').data('classcode');
    
    // 전체 다운로드 위해 추가
    $('form[name="total_down_form"] input[name="year"]').val(openYr);
    $('form[name="total_down_form"] input[name="cls"]').val(classCode);
    $('form[name="total_down_form"] input[name="nationCd"]').val(nationCode);
    $('form[name="total_down_form"] input[name="orgType"]').val(commonData.type);
    $('form[name="total_down_form"] input[name="tblType"]').val(commonData.nowTblType);
    
    $.ajax({
        url:'/api/inv/invFileList.do',
        type:'post',
        dataType:'json',
        data:{
            'invSeq':seq, 
            'invYear':openYr,
            'orgType':commonData.type,
            'nationCode':nationCode,
            'classCode':classCode,
            'type': commonData.nowTblType
        },
        success:function(data){
            
            $('.upload-list').empty();
            
            var list = "";
            
            if(data.data.invFiles.length > 0){
                for(var i=0; i<data.data.invFiles.length; i++){
                    var row = data.data.invFiles[i];
                    list += '<li>';
                    list += '<div class="file-info m-column">';
                    list += '<div class="file-name"><i class="svg-icon file_' + row.fileExt.toLowerCase() + '"></i> '+row.fileOrg+'</div>';
                    if(row.nationCode == '1000' || row.nationCode == null){
                        list += '<button type="button" class="krds-btn medium text" onclick="down_file(\''+row.orgAttNo+'\', \''+row.openYear+'\')">다운로드 <i class="svg-icon ico-down"></i></button>';
                    } else {
                        list += '<button type="button" class="krds-btn medium text" onclick="down_wld_file(\''+row.orgAttNo+'\', \''+row.openYear+'\')">다운로드 <i class="svg-icon ico-down"></i></button>';
                    }
                    list += '</div></li>';
                }
                
                var dropTr  = '<tr class="drop-tr" style="display: table-row;">';
                dropTr += '    <td colspan="5" style="padding:0;">';
                dropTr += '        <div class="download-drop" style="display: block;">';
                dropTr += '            <div class="modal-header">';
                dropTr += '                <h2 class="modal-title">다운로드</h2>';
                dropTr += '                <div class="down-link">';
                dropTr += '                    <button type="button" class="krds-btn xsmall" onclick="total_down();">';
                dropTr += '                        <i class="svg-icon ico-down"></i> 전체 압축파일 받기';
                dropTr += '                    </button>';
                dropTr += '                </div>';
                dropTr += '            </div>';
                dropTr += '            <div class="krds-file-upload">';
                dropTr += '                <div class="file-list">';
                dropTr += '                    <ul class="upload-list">';
                dropTr += list                        
                dropTr += '                    </ul>';
                dropTr += '                </div>';
                dropTr += '            </div>';
                dropTr += '        </div>';
                dropTr += '    </td>';
                dropTr += '</tr>';
                
                $tr.after(dropTr);
                
            } else {
                alert('첨부파일이 없습니다.');
            }
        }
    });

}

function down_file(attNo, year){
	$('form[name="down_form"]').find('input[name="year"]').val(year);
	$('form[name="down_form"]').find('input[name="seq"]').val(attNo);
	$('form[name="down_form"]').find('input[name="orgType"]').val(commonData.type);
	
	$('form[name="down_form"]').prop('action', '/inv/org/download.do');
	$('form[name="down_form"]').submit();
}

function down_wld_file(stNo){
    $('form[name="down_form"]').find('input[name="seq"]').val(stNo);
    $('form[name="down_form"]').find('input[name="year"]').val('');
    
    $('form[name="down_form"]').prop('action', '/inv/wldorg/download.do');
    $('form[name="down_form"]').submit();
}

// 전체다운로드
function total_down(){
    // TODO: 본문 보기 페이지 창이 닫히는 문제 해결해야 함
    $('form[name="total_down_form"]').submit();
}

function comparison(){
	if(tableType == 'tableType1'){
// 		$('input[name="chk"]').each(function(){
// 			if($(this).prop('checked')){
// 				var num = ($(this).prop('id').replace('chk_', '')*1)-1;
// 				selectRow.push(boardData[num]);
// 			}
// 		});
		
		let selYear = $('select[name="stYear"]').is(":visible") ? $('select[name="stYear"] option:selected').val() : null;
		
		if(selectRow.length > 20){
			alert('최대 20개까지 선택하실 수 있습니다.');
		}else if(selectRow.length > 0){
			$('form[name="mult_form"]').find('input[name="multiData"]').val(JSON.stringify(selectRow));
			$('form[name="mult_form"]').find('input[name="orgType"]').val(commonData.type);
			$('form[name="mult_form"]').find('input[name="tblType"]').val(commonData.nowTblType);
			$('form[name="mult_form"]').find('input[name="openYear"]').val(selYear);
            $('form[name="mult_form"]').find('input[name="nationCode"]').val('1000');
			
			window.open('', 'comparisonView');
			
			$('form[name="mult_form"]').submit();
			
			$('form[name="mult_form"]').find('input[name="multiData"]').val('');
		} else {
			krds_modal.openModal("notHasChks");
		}
	}
}

function del_row(seq){
	for(var i=0; i<selectRow.length; i++){
		if(selectRow[i].seq == seq){
			selectRow.splice(i, 1);
			$('.compar-body > .compar-list > li').each(function(){
				if($(this).find('input[name="seqInfo"]').val() == seq){
					$(this).remove();
				}
			});
			$('input[name="chk"]').each(function(){
				if($(this).val() == seq){
					$(this).prop('checked', false);
				}
			});
		}
	}
}

	//우리나라/세계교육과정 노이미지 애니메이션
	  gsap.registerPlugin(MotionPathPlugin);
	
	  function runAnimation(cursorEl, aniChkEl) {
	    // 중복 실행 방지
	    if (cursorEl.dataset.animated === "true" || aniChkEl.dataset.animated === "true") {
	      return;
	    }
	    cursorEl.dataset.animated = "true";
	    aniChkEl.dataset.animated = "true";
	
	    gsap.set(cursorEl, { x: 0, y: 20 });
		gsap.set(aniChkEl, { clearProps: "transform" });
	
	    const tl = gsap.timeline({
	      repeat: -1,
	      repeatDelay: 2,
	      defaults: { ease: "power2.inOut" },
	      onStart: () => console.log("🟢 시작됨"),
	      onRepeat: () => console.log("🔁 반복됨")
	    });
	
	    tl.to(cursorEl, {
	      duration: 2,
	      motionPath: {
	        path: [
	          { x: 0, y: 20 },
	          { x: -30, y: 50 },
	          { x: -120, y: 120 },
	          { x: -150, y: 130 },
	          { x: -250, y: 140 }
	        ],
	        curviness: 1,
	        autoRotate: false
	      }
	    });
	
	    tl.to(cursorEl, {
	      scale: 1.1,
	      duration: 0.2,
	      ease: "power2.out"
	    });
	    tl.to(cursorEl, {
	      scale: 1,
	      duration: 0.3,
	      ease: "elastic.out(1, 0.4)"
	    });
	
	    tl.to(aniChkEl, {
	      scale: 1.1,
	      backgroundColor: "#083891",
	      borderColor: "#083891",
	      duration: 0.2
	    }, "<");
	
	    tl.to(aniChkEl, {
	      scale: 1,
	      duration: 0.4,
	      ease: "elastic.out(1, 0.4)"
	    });
	
	    tl.to(aniChkEl, {
	      backgroundColor: "#9E9E9E",
	      borderColor: "#9E9E9E",
	      delay: 0.6,
	      duration: 0.6
	    });
	
	    tl.to(cursorEl, {
	      duration: 2,
	      motionPath: {
	        path: [
	          { x: -250, y: 140 },
	          { x: -150, y: 130 },
	          { x: -120, y: 120 },
	          { x: -30, y: 50 },
	          { x: 0, y: 20 }
	        ],
	        curviness: 1,
	        autoRotate: false
	      }
	    });
	  }
	
	  // 초기 로드 시 존재하는 모든 쌍에 애니메이션 실행
	  const cursors = document.querySelectorAll(".cursor");
	  const aniChks = document.querySelectorAll(".ani_chk");
	
	  cursors.forEach((cursorEl, idx) => {
	    const aniChkEl = aniChks[idx];
	    if (aniChkEl) {
	      runAnimation(cursorEl, aniChkEl);
	    }
	  });
	
	  // MutationObserver: 새로 추가되는 .cursor, .ani_chk 쌍 감지 및 애니메이션 실행
	  const observer = new MutationObserver((mutations) => {
	    mutations.forEach((mutation) => {
	      mutation.addedNodes.forEach((node) => {
	        if (!(node instanceof HTMLElement)) return;
	
	        // 새로 추가된 노드 또는 자식 노드 중 .cursor, .ani_chk 찾기
	        const newCursors = node.matches(".cursor") ? [node] : node.querySelectorAll(".cursor");
	        const newAniChks = node.matches(".ani_chk") ? [node] : node.querySelectorAll(".ani_chk");
	
	        // 가능한 쌍만큼 애니메이션 실행
	        newCursors.forEach((cursorEl, i) => {
	          const aniChkEl = newAniChks[i];
	          if (aniChkEl) {
	            runAnimation(cursorEl, aniChkEl);
	          }
	        });
	      });
	    });
	  });
	
	  observer.observe(document.body, { childList: true, subtree: true });


	//우리나라/세계교육과정 노이미지 애니메이션 - 탭
	let fingerTl;
	const width = window.innerWidth;

	function initAnimation() {
	  const isMobile = width < 768;
	  const isSmallMobile = width == 540;
	  
	  // 타임라인 중복 제거
	  if (fingerTl) {
	    fingerTl.kill();
	    fingerTl = null;
	  }
	
	  // hand_with_phone 초기 세팅
	  gsap.set(".hand_with_phone", {
	    x: isSmallMobile ? -100 : (isMobile ? -45 : -100),
	    y: isMobile ? -80 : -115,
	    opacity: 0,
	    rotate: isMobile ? 45 : 40
	  });
	
	  // finger 초기 세팅
	  gsap.set(".finger", {
	    x: isSmallMobile ? 100 : (isMobile ? '16.5vw' : 130),
	    y: isSmallMobile ? 15 : (isMobile ? 0 : 10),
	    rotate: 51,
	    opacity: 1,
	    scale: 1,
	    clearProps: "rotate"
	  });
	
	  // 핸드 애니메이션 실행
	  gsap.to(".hand_with_phone", {
	    duration: 1.5,
	    ease: "power2.out",
	    opacity: 1,
	    rotate: 0
	  });
	
	  // finger 애니메이션 타임라인
	  fingerTl = gsap.timeline({ repeat: -1, repeatDelay: 1 });
	
	  fingerTl
	    .to(".finger", {
	      delay: 2,
	      duration: 2,
	      ease: "power2.out",
	      rotate: 0
	    })
	    .to(".finger", {
	      duration: 0.2,
	      scale: 1.05,
	      ease: "power1.inOut"
	    })
	    .to(".finger", {
	      duration: 0.4,
	      scale: 0.98,
	      ease: "power1.inOut"
	    })
	    .to(".finger", {
	      duration: 0.3,
	      scale: 1,
	      ease: "bounce.out"
	    })
	    .to(".finger", {
	      duration: 2,
	      ease: "power2.inOut",
	      rotate: 51
	    });
	}
	
	// 초기 실행
	requestAnimationFrame(() => {
	  requestAnimationFrame(() => {
	    initAnimation();
	  });
	});
	
	// 디바운스된 리사이즈 이벤트
	window.addEventListener("resize", () => {
	  initAnimation();
	});

function reset_list(){
	
	// 체크박스 초기화
	selectRow = [];
	$('input[name="chk_all"]').prop('checked', false);
	
	$('.search-list-top strong').html( '0' );    // 합계 초기화
	
	step1 = '';
	step2 = '';
	step3 = '';
	
	var spanCnt = 7;
	if(nowTblType == 'dwn'){
		spanCnt = 6;
	}
	
	var defaultTr = "<tr><td colspan=\"" + spanCnt + "\" style=\"padding:0;\">" +
	"<div class=\"eduClass_noimg\">" +
		"<p class=\"web\">좌측 파일 형태로 나열된 인벤토리 중 <strong>찾으시는 인벤토리 체크박스에 체크바랍니다.</strong></p>" +
		"<div class=\"tablet\">" +
			"<div class=\"inv_tab_ani\">" +
				"<span class=\"finger\"><img src=\"/images/default/content/inv_tab_ani_2.webp\"></span>" +
				"<span class=\"hand_with_phone\"><img src=\"/images/default/content/inv_tab_ani_1.webp\"></span>" +
				"<img src=\"/images/default/content/inv_tab_ani_bg.webp\" alt=\"인벤토리 검색 버튼을 눌러 찾으시는 인벤토리를 바로 검색해보세요.\" class=\"tab_noimg\">" +
			"</div>" +
			"인벤토리 검색 버튼을 눌러 <strong>찾으시는 인벤토리를 바로 검색해보세요.</strong>" +
		"</div>" +
		"<div class=\"inv_ani\">" +
			"<span class=\"cursor\"><img src=\"/images/default/content/inv_ani_cursor.webp\"></span>" +
			"<span class=\"ani_chk\"><i class=\"xi-check\"></i></span>" +
			"<img src=\"/images/default/content/ec_noimg_phone.webp\" alt=\"좌측 파일 형태로 나열된 인벤토리 중 찾으시는 인벤토리 체크박스에 체크 바랍니다\" class=\"web_noimg\">" +
		"</div>" +
	"</div>" +
"</td></tr>";
	
	$('.defaultTbl tbody').html(defaultTr);
	
	$('.compar-body > .compar-list > li:not(.infoLi)').each(function(){
		$(this).remove();
	});
	
	$('.krds-pagination').hide();
	$('.list_loading').hide();
	
	//애니메이션 초기화 코드
	requestAnimationFrame(() => {
		initAnimation();
	});
	
}



function printYear(nationCd){
	$('select[name="stYear"]').html('');
	let addHtml = '';
	for(var i=0; i<yearList.length;i++){
		if(yearList[i].nationCd == nationCd){
			addHtml += '<option value="'+yearList[i].stYear+'">'+yearList[i].stYear+'년</option>';			
		}
	}
	$('select[name="stYear"]').html(addHtml);
}

// 간력정보 가져오기
async function fn_chagne_briefing(orgType, nowTblType, nationCode ){
	let selYear = $('select[name="stYear"]').is(":visible") ? $('select[name="stYear"] option:selected').val() : null;
	
	return new Promise((resolve, reject) => {
		try{
			dcpost(
			sub + '/api/inv/getMyBriefingList.do',
			{
	            'openYear':selYear, 
	            'orgType':orgType,
	            'nowTblType':nowTblType,
	            'nationCode':nationCode,
	        }).success(function(data){
				briefingList = [];
				if(typeof data.briefingList !== "undefined"){
					for(var i=0; i<data.briefingList.length;i++){
						let row = data.briefingList[i];
						briefingList.push(row);
					}
				}
				resolve(true); 
			}).error(function(e){
				resolve(false); 
				console.log(e);	
			})
		}catch(e){
			resolve(false); 
			console.log(e);
		}
	});
	
}

// 즐겨찾기 가져오기
async function fn_chagne_bookmark(orgType, nowTblType, nationCode ){
	let selYear = $('select[name="stYear"]').is(":visible") ? $('select[name="stYear"] option:selected').val() : null;
	
	return new Promise((resolve, reject) => {
		try{
			dcpost(
			sub + '/api/inv/getMyBookMarkList.do',
			{
	            'openYear':selYear, 
	            'orgType':orgType,
	            'nowTblType':nowTblType,
	            'nationCode':nationCode,
	        }).success(function(data){
                let $ul =$('.wishList .list-items ul');
                $ul.empty()
                
				bookmarkList = [];
				if(typeof data.bookmarkList !== "undefined"){
					for(var i=0; i<data.bookmarkList.length;i++){
						let row = data.bookmarkList[i];
						bookmarkList.push({'bk_idx':row.bkIdx, 'inv_no':row.invNo, 'tbl_type':row.tblType, 'degree_cd':row.degreeCode, 'class_cd':row.classCode, 'open_year':row.openYear, 'open_month':row.openMonth, 'subject_cd':row.subjectCode});
						
						// 즐겨찾는 교육과정 추가
                        let $li = $("<li>").attr("data-value", row.bkIdx)
                                        .text(row.location + " > " + row.invNm)
                                        .on("click", function() {
                                            move_view(nowTblType, selYear, '', row.invNo);  // 함수 실행
                                        });
                        $ul.append($li);
					}
				}
				resolve(true); 
				
			}).error(function(e){
				resolve(false); 
				console.log(e);	
			})
		}catch(e){
			resolve(false); 
			console.log(e);
		}
	});
	
	

}
	