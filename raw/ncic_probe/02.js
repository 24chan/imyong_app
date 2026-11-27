let boardData;

let commonData;

 	
//전달받은 인자를 통해서 트리를 자동으로 펼친다
let step1;
let step2;
let step3;
let step4;

// 영문 번역 시 사용되는 용어집 단어 
const glossary = {
    "총론": "The National Framework for the Elementary and Secondary",
    "실과(기술 · 가정)/정보": "The practical arts (technology/home economics) and informatics",
    "바른 생활, 슬기로운 생활, 즐거운 생활": "The Moral Life, Inquiring Life, and Pleasant Life",
    "한국어 교육과정": "The Korean as a Second Language",
    "국어": "Korean Language",
    "사회": "Social Studies",
    "도덕": "Moral Education",
    "수학": "Mathematics",
    "과학": "Science",
    "기술·가정": "Technology/Home economics",
    "정보": "Informatics",
    "체육": "Physical Education",
    "음악": "Music",
    "미술": "Art",
    "영어": "English",
    "창의적 체험활동": "Creative Experiential Activities",
    "선택": "Elective Subjects",
    "환경": "Environment",
    "보건": "Health Education",
    "생활 외국어": "Daily Foreign Language",
    "한문": "Classical Chinese",
    "진로와 직업": "Career & Occupations",
    "한국어 교육": "Korean as a Second Language",
    "실과": "Practical Arts",
    "바른생활": "Moral Life",
    "슬기로운 생활": "Inquiring Life",
    "즐거운 생활": "Pleasant Life",
    "제2외국어": "Second Foreign Language",
    "교양": "Liberal Arts",
    "과학 계열": "Specialized Science Course",
    "체육 계열": "Specialized Physical Education Course",
    "예술 계열": "Specialized Arts Course",
    "전문 교과": "Specialized Subjects"
};

function InventoryTree(options) {
	$("#treeLoading").show();
	
  	options = options || {};

	const containerId = options.inDiv || "menuTree";
	//console.log("do tree : " + containerId);

	// 공통 인자
	commonData = {
		type: options.orgType || "",
		degreeCode: options.degreeCode || "",
		classCode: options.classCode || "",
		openYear: options.openYear || "",
		openMonth: options.openMonth || "",
		subjectCode: options.subjectCode || "",
		subjectDefCode: options.subjectDefCode || "",
		menuType: options.menuType || "1",
		printType: options.printType || "adm",
		nationCode : options.nationCode || "",
		nowTblType : options.nowTblType || "",
		invDepth : 1,
		nationNumber : options.nationNumber || ""
	};
	
	const isAdmin = commonData.printType =='adm'?true:false

	console.log(commonData);

	$("#" + containerId).fancytree({
		checkbox: isAdmin?false:true ,
		selectMode: 3,
		icon: function(event, data) {
			const node = data.node;
			const level = data.node.getLevel();
			
			if (!node.folder) return false;
			
			// 아이콘 경로 반환
			return level === 1
				? "/images/default/content/dt_all.svg"
				: "/images/default/content/dt_folder.svg";
		},
		source: [
			{
				title: mainTitle,
				key: "root",
				folder: true,
				expanded: true,
				lazy : true
			}
		],
		beforeCollapse: function(event, data) {
            if (data.node.key === "root") {
                return false; 
            }
        },
		lazyLoad: function(event, data) {
			const node = data.node;
		
			data.result = {
				url: sub + "/api/inv/inventoryNodeList.do",
				type: "POST",
				data: {
					type : commonData.type, // 시대
					nowTblType : commonData.nowTblType, //원문 | 표준
					menuType : commonData.menuType,  // 원문 ( 1- 시대 , 2 - 학교별 , 3-영역 ) , 표준 - 1고정
					invDepth: node.data.invDepth || 1,
					degreeCode : node.data.degreeCode,
					classCode : node.data.classCode,
					subjectCode : node.data.subjectCode,
					subjectDefCode : node.data.subjectDefCode,
					nationCode : commonData.nationCode == '' ? node.data.nationCode : commonData.nationCode,
					openYear : commonData.openYear == '' ? node.data.openYear : commonData.openYear,
					openMonth : node.data.openMonth,
					ref : node.data.ref,
					isAdmin : (isAdmin?'1':'0')
					
				}
			};
			
		},
		
	   loadChildren: function (event, data) {
		  // 영문 번역을 유지하기 위해 추가 bk
	      gtx.apply($(data.tree.$container));
	   },
		renderNode: isAdmin ? renderNodeAdmin : renderNodeUser,
		init: function(event, data) {
			const tree = data.tree;
			const rootNode = tree.getRootNode().getChildren().find(n => n.key === "root");
			console.log(rootNode);
			if (rootNode && rootNode.lazy && !rootNode.children) {
				// 스피너 표시 (선택사항)
				//$("#treeLoading").show();
	
				// 바로 Ajax 호출
				rootNode.load().done(function() {
					//$("#treeLoading").hide();
					if(step1 != ''){
						expandAndSelect(tree, step1, step2, step3, step4);
					}
					// 로드시 루트가 체크되는 부분 필요없으면 주석
					//rootNode.setSelected(true); // 루트가 체크됨
				});
			}
			
			
		},
		click:function(event, data){
			if(!$(event.originalEvent.target).hasClass("fancytree-checkbox")){
				var node = data.node;
				
				console.log(node);
				console.log(node.key);
				
				// root 폴더 닫힘 실행 방지
				if(node.key === 'root') {
                    return false;
                }
				
				if(node.lazy && !node.children){
					node.load().done(function(){
						if(node.hasChildren()){
							node.setExpanded(true);
						} else {
							node.setSelected(true);
						}
					})
				} else {
					if(node.hasChildren()){
						node.toggleExpanded();
					} else {
						node.setSelected(true);
					}
				}
			}
			
			/*
			if (node.children && node.children.length > 0) {
		      // 자식 노드가 있는 경우: toggle (펼치기/접기)
		      node.toggleExpanded();
		    } else {
		      // 자식 노드가 없는 경우: 선택 이벤트 강제로 발생
		      node.setSelected(true);
		      
		      // 필요하다면 별도의 처리도 여기서 가능
		      console.log("Selected node:", node.title);
		    }
		    */
		},
		dblclick: function(event, data) {
            var node = data.node;
            
            // root 폴더 닫힘 실행 방지
            if(node.key === 'root') {
                    return false;
                }
        },
		select: function(event, data){
			
			//얘가 선택
			const node = data.node;

			if (!isAdmin && node.getLevel() >= checkboxLevel) {
				const isChecked = node.isSelected();
				loadAndSelectAll(node, isChecked); // 하위 열고 체크
				//printList(); // 선택 반영
			}
		},
		postRender: function(event, data) {
	        const node = data.node;
	        const originalText = node.title; // 원본 텍스트

	        // 현재 언어 확인 (GTranslate 쿠키 체크)
	        const currentLang = document.cookie.split('; ').find(row => row.startsWith('googtrans='));
	        const isEnglish = currentLang && currentLang.includes('/en');

	        // 영문일 경우이면서 용어집에 있는 단어라면
	        if (isEnglish && glossary.hasOwnProperty(originalText)) {
	            // Fancytree가 이미 생성해 둔 원래의 .fancytree-title 요소를 정확히 타겟팅
	            const $titleSpan = $(node.span).find('.fancytree-title');

	            // 1. 텍스트를 용어집 영문으로 교체
	            $titleSpan.text(glossary[originalText]);

	            // 2. 구글 번역 방지 클래스 추가 (.fancytree-title과 .notranslate가 함께 들어감)
	            $titleSpan.addClass('notranslate');
	        }
	    }
	});
}



// 나중에 버튼 추가
function renderNodeUser(event, data){
	const node = data.node;
	const $span = $(node.span);
	const level = node.getLevel();

	//console.log(node.data);
	//console.log(briefingList);
	//console.log(bookmarkList);
	$span.find(".custom-buttons").remove();
	
	// 체크박스 노출 조건 => 풀면 느려짐
	if (level < checkboxLevel) {
		$span.find("span.fancytree-checkbox").hide();
		node.unselectable = true;
	} else {
		node.unselectable = false;
	}
	
    var originalText = node.title;
	
	if (glossary.hasOwnProperty(originalText)) {
            
        // 구글 번역 방지 클래스 추가
        $titleSpan = $span.find(".fancytree-title");
        $titleSpan.addClass("notranslate");

        // 현재 언어 확인 (GTranslate 쿠키 체크)
        const currentLang = document.cookie.split('; ').find(row => row.startsWith('googtrans='));
        const isEnglish = currentLang && currentLang.includes('/en');

        // 영문일 경우 텍스트 교체
        if (isEnglish) {
            $titleSpan.text(glossary[originalText]);
        } else {
            $titleSpan.text(originalText); // 한국어일 땐 원문 유지
        }
    }
	
	const $buttonWrap = $("<span>", { class: "custom-buttons", style: "margin-left: 8px;" });
	
	if(orgType != 'wld'){  // 우리나라 교육과정만
	
		let hasHstry 	= false;
		let ck_idx 		= '';
		
		if(typeof node.data.rootIdx !== "undefined"){
			
			for(var i=0;i < briefingList.length;i++){
				var row = briefingList[i];
				if(row.rootIdx == node.data.rootIdx){
					ck_idx = row.ckIdx;
					hasHstry = true;
				}
			}
				
		}else if(commonData.nowTblType == "org"){
			
			const degreeCd 		= typeof node.data.degreeCode === 'undefined'?null:(node.data.degreeCode != ''?node.data.degreeCode:null);
			const classCd 		= typeof node.data.classCode === 'undefined'?null:(node.data.classCode != ''?node.data.classCode:null);
			const openYear      = typeof node.data.openYear === 'undefined'?null:(node.data.openYear != ''?node.data.openYear:null);
			const openMonth     = typeof node.data.openMonth === 'undefined'?null:(node.data.openMonth != ''?node.data.openMonth:null);
			const subjectCd 	= typeof node.data.subjectCode === 'undefined'?null:(node.data.subjectCode != ''?node.data.subjectCode:null);
			const subjectDefCd 	= typeof node.data.subjectDefCode === 'undefined'?null:(node.data.subjectDefCode != ''?node.data.subjectDefCode:null);
			const rootIdx       = typeof node.data.ref === 'undefined'?null:(node.data.ref != ''?node.data.ref:null);
			
			//console.log(degreeCd + "\n" + classCd + "\n" + openYear + "\n" + openMonth + "\n" +subjectCd);
			for(var i=0;i < briefingList.length;i++){
				var row = briefingList[i];
				if(!(degreeCd == null && classCd == null && subjectCd == null && openYear == null && rootIdx == null) 
				    && row.degreeCode == degreeCd && row.classCode == classCd  && row.subjectCode == subjectCd && row.stYear == openYear && row.rootIdx == rootIdx && row.openMonth == openMonth){
					ck_idx = row.ckIdx;
					hasHstry = true;	
				}
			}
			
		} 
		
		if(hasHstry){
			const $viewBtn = $("<button>", {
		        html: "<i class=\"recap_icon\"></i> 간략정보",
		        class: "inv_recap_btn",
		        click: function(e) {
				    e.stopPropagation();    // 하위 아이템 온오프 방지
				    
    				$.ajax({
                        url:'/api/inv/getMyBriefing.do',
                        type:'post',
                        dataType:'json',
                        data:{
                            'ckIdx': ck_idx
                        },
                        success:function(rst){
                            const result = rst.data;
                            
                            if(result.code == 'success'){
                                e.stopPropagation();
                                
                                let parent = node.getParent();
                                
                                $('#popEduInfo .popCont .sub-head h3').text(node.title + ' 간략정보 안내');
                                $('#popEduInfo .popCont .popContScroll').html(result.vo.content);
                                $('#popEduInfo').addClass('open');
                            } else {
                                alert(result.msg);
                            }
                        },
                        error : function(e){
                            handleAjaxError(e);
                        }
                    });
		        }
		    });
		    
		    $buttonWrap.append($viewBtn);
		}
	}
	
	$span.append($buttonWrap);
	
}

function renderNodeAdmin(event, data){
	const node = data.node;
	const title = node.title;
	const $span = $(node.span);
	const $buttonWrap = $("<span>", { class: "custom-buttons", style: "margin-left: 8px;" });
	
	$span.find(".custom-buttons").remove();
	
	let minLevel = 4; //원문
	if(commonData.nowTblType == 'std') minLevel = 1;   // 표준
	if(commonData.nowTblType == 'wldorg') minLevel = 1;  // 세계교육과정 원문인벤토리 
	
	if (node.getLevel() >= minLevel) {
		if(orgType != 'wld'){
			if(node.data.hasChild == '1'){
			
				const $viewBtn = $("<button>", {
			      text: "하위메뉴관리",
			      class: "btn-view",
			      click: function(e) {
			        e.stopPropagation();
			        
			        alert('내용이 설정된 메뉴는 하위메뉴를 변경하실 수 없습니다.\n내용을 삭제 후 다시시도해주십시오.')
			      }
			    });
			
			    $buttonWrap.append($viewBtn);
				
			}else{
				const $viewBtn = $("<button>", {
			      text: "하위메뉴관리",
			      class: "btn-view",
			      click: function(e) {
			        e.stopPropagation();
			        
			        load_menu_form(node.data , title, node);  // 원하는 함수에 seq 전달
			      }
			    });
			
			    $buttonWrap.append($viewBtn);
			}
			
		} else if(commonData.nowTblType == 'wldorg' && node.getLevel() == 2) {    // 세계교육과정 원문인벤토리 
            const $viewBtn = $("<button>", {
                  text: "하위메뉴관리",
                  class: "btn-view",
                  click: function(e) {
                    e.stopPropagation();
                    
                    load_menu_form(node.data , title, node);  // 원하는 함수에 seq 전달
                  }
                });
            
                $buttonWrap.append($viewBtn);
        }
        
        if(orgType == 'ogi4' && node.getLevel() == 4) {
            const $viewBtn = $("<button>", {
                  text: "파일관리",
                  class: "btn-file",
                  click: function(e) {
                      e.stopPropagation();
                      load_content_form(node.data , title, node, 2);  // 원하는 함수에 seq 전달
                  }
                });
            
            $buttonWrap.append($viewBtn);
        }
	    
	    if(!node.folder){
		    const $deleteBtn = $("<button>", {
                text: "내용관리",
                class: "btn-delete",
                click: function(e) {
                    e.stopPropagation();
                    if(commonData.nowTblType === 'wldorg') {
                        load_content_form(node.data , title, node, 2); 
                    } else {
                        load_content_form(node.data , title, node, 1); 
                    }
                }
            });
            
		    $buttonWrap.append($deleteBtn);
		    
		}
	}
	
	// 간략정보
	if(node.getLevel() >= 2 && node.folder){
        if(orgType != 'wld') {    // 우리나라 교육과정만
            const $briefingBtn = $("<button>", {
                text: "간략정보",
                class: "btn-briefing",
                click: function(e) {
                    e.stopPropagation();
                    load_content_form(node.data , title, node, 3); 
                }
            });
            
            $buttonWrap.append($briefingBtn);
        }
    }
    
    $span.append($buttonWrap);
        
}





let isBulkSelecting = false;
let updateTimer = null;

// jQuery Deferred → Promise 변환 함수
function waitForLoad(node) {
	return new Promise((resolve, reject) => {
		node.load().done(resolve).fail(reject);
	});
}

async function loadAndSelectAll(node, state, isRoot = true) {
	
  if (isRoot) {
		if (isBulkSelecting) return;
		isBulkSelecting = true;
	}

	try {
        $('.down-modal').removeClass('in');     // 다운로드 모달 제거
        
		$('.loading').show();	//로딩바 시작
		
		if (node.lazy && !node.children) {
			await waitForLoad(node); // 로드 완료까지 대기
		}

		if (!node.unselectable) node.setSelected(state);
		//node.setExpanded(true);

		if (node.children) {
			for (const child of node.children) {
				await loadAndSelectAll(child, state, false);
			}
		}
	} catch (err) {
		console.error("노드 로딩 실패", err);
	} finally {
		
		if (isRoot) {
			isBulkSelecting = false;
		}
		
		if (updateTimer) {
			clearTimeout(updateTimer);
		}
		updateTimer = setTimeout(() => {
			printList(); // 체크된 노드 → 리스트로
		}, 1000);
		
		$('#tree_loading').hide();	//끝났으면 로딩바 제거
		
		//프로그래스 종료 여기서? 체크해보기
		
	}
}



function printList(){
	boardData = getSelectedLeafNodes();
	console.log(boardData);
	
	if(boardData.length == 0){
		//자료없음부분 해결 필요
		//alert('자료없어')
		reset_list();
	}else{
		initPagination();
	}
	
}



//리스트 출력

function getSelectedLeafNodes() {
	console.log(target);
	const tree = $.ui.fancytree.getTree( "#" + target); // 트리 ID에 맞게 조정
	const selectedNodes = tree.getSelectedNodes();


	// 체크되었고, 폴더가 아닌 노드만 필터링
	const result = selectedNodes
		.filter(node => !node.folder && node.selected)
		.map(node => ({
			title: node.title,
			seq: node.data.ref,
			location: getNodeLocationPath(node),
			data : node.data
		}));

	return result;
}


function getNodeLocationPath(node) {
	let path = [];
	let current = node.getParent();

	while (current && current.getLevel() > 1) {
		// 맨 위 루트 제외 가능하려면 조건 조절
		path.unshift(current.title);  // 앞에 추가
		current = current.getParent();
	}

	return path.join(" > ");  // 원하는 구분자로 변경 가능
}


//이하 페이징 함수
function initPagination() {
  const state = {
    data: boardData || [],
    currentPage: 1,
    perPage: parseInt($('select#select_td').val(), 10) || 20,
    maxPageLinks: 5
  };

  function getTotalPages() {
    return Math.max(1, Math.ceil(state.data.length / state.perPage));
  }

  async function renderList() {
    await fn_chagne_bookmark(orgType, nowTblType, '1000');
    
    const start = (state.currentPage - 1) * state.perPage;
    const end   = start + state.perPage;
    const items = state.data.slice(start, end);

	$('.search-list-top strong').html( state.data.length );

    const $tbody = $('#panel_edu_01 #'+ tableType +' table.defaultTbl tbody');
    $tbody.empty();
    
    
    $.each(items, function (i, item) {
        // 템플릿은 상황에 맞게 수정
    	let bkCk = '';
		for(var j=0; j < bookmarkList.length; j++){
		    var row = bookmarkList[j];
		    
		    if(nowTblType == 'dwn') {
                if(row.degree_cd == item.data.degreeCode 
                    && row.class_cd == item.data.classCode 
                    && row.open_year == item.data.openYear 
                    && row.open_month == item.data.openMonth 
                    && row.subject_cd == item.data.subjectCode){
                        
                    bkCk = 'on';
                }
                
            } else {
                if(row.inv_no == item.seq){
                    bkCk = 'on';
                }
            }
		}  
		
		var titleText = item.title;
		var translateClass = '';
    
        if (glossary.hasOwnProperty(titleText)) {
            translateClass = "notranslate";
                
            // 현재 언어 확인 (GTranslate 쿠키 체크)
            const currentLang = document.cookie.split('; ').find(row => row.startsWith('googtrans='));
            const isEnglish = currentLang && currentLang.includes('/en');
    
            // 영문일 경우 텍스트 교체
            if (isEnglish) {
                titleText = glossary[item.title];
            } else {
                titleText = item.title;
            }
        }
      
      if(tableType == 'tableType1'){ // 원문,표준 인벤토리
    	 var row = ''
          + '<tr data-seq="'+ item.seq + '" data-degreeCode="' + item.data.degreeCode + '" data-classCode="' + item.data.classCode + '" data-openYear="' + item.data.openYear + '" data-openMonth="' + item.data.openMonth + '" data-subjectCode="' + item.data.subjectCode +'">'
          +   '<td class="check">'
          +     '<input type="hidden" name="invYear" value="'+item.data.openYear+'" />'
          +     '<div class="krds-form-check">'
          +       '<input type="checkbox" name="chk" id="chk_' + (start + i + 1) + '" value="'+item.seq+'">'
          +       '<label for="chk_' + (start + i + 1) + '"><span class="sr-only">선택</span></label>'
          +     '</div>'
          +   '</td>'
          +   '<td class="num">' + (start + i + 1) + '</td>'
          +   '<td class="inven">' + nowPage + '</td>'
          +   '<td class="generation">' + orgName + '</td>'
          +   '<td class="class">'
          +     '<div class="class_box">'
          +       '<div class="txt_box">'
          +         '<em class="class_route">' + (item.location || '') + '</em>'
          +         (item.title || '')
          +       '</div>'
          +       '<div class="bookmark">'
          +         '<span class="svg-icon ico-star '+bkCk+'"></span>'
          +       '</div>'
          +     '</div>'
          +   '</td>'
          +   '<td class="content">'
          +     '<a href="javascript:move_view(\'' + nowTblType + '\', \''+item.data.openYear+'\', \''+item.location+'\', \'' + item.seq + '\')" class="krds-btn small link"><span class="underline">보기</span></a>'
          +   '</td>'
          +   '<td class="download">';
          
          if(nowTblType === 'org') {        // 원문인벤토리만 첨부파일 존재
            row += ''  
                  +     '<button type="button" class="krds-btn xsmall open-modal" data-target="modal_down01">'
                  +       '<span class="sr-only">다운로드</span> <i class="svg-icon ico-down"></i>'
                  +     '</button>';
          }
          
          row += '</td></tr>';
          
          $tbody.append(row);
      }else if(tableType == 'tableType2'){ //원문 및 해설서
    	
    	
    	 var row = ''
          + '<tr data-seq="'+ item.seq  + '" data-degreeCode="' + item.data.degreeCode + '" data-classCode="' + item.data.classCode + '" data-openYear="' + item.data.openYear + '" data-openMonth="' + item.data.openMonth + '" data-subjectCode="' + item.data.subjectCode +'">'
          +   '<td class="num">' + (start + i + 1) + '</td>'
          +   '<td class="inven">' + nowPage + '</td>'
          +   '<td class="class">'
          +     '<div class="class_box">'
          +       '<div class="txt_box">'
          +         '<em class="class_route">' + (item.location || '') + '</em>'
          +         '<span class="' + translateClass + '">' + (titleText || '') + '</span>'
          +       '</div>'
          +       '<div class="bookmark">'
          +         '<span class="svg-icon ico-star '+bkCk+'"></span>'
          +       '</div>'
          +     '</div>'
          +   '</td>'
          +   '<td class="download">'
          +     '<button type="button" class="krds-btn xsmall open-modal" data-target="modal_down01">'
          +       '<span class="sr-only">다운로드</span> <i class="svg-icon ico-down"></i>'
          +     '</button>'    
          +   '</td>'
          + '</tr>';
          
          $tbody.append(row);
    	
      }else if(tableType == 'tableType3'){ //세계 교육과정
    	
    	let code = "";
    	let tdData = "";
    	if(commonData.nationNumber != ""){
    		code = commonData.nationNumber;
    	}else{
    		code = item.data.nationCode;
    	}
    	
    	if(type == "wld"){
    		tdData =  '<td class="content">'
                      +     '<a href="javascript:move_view(\'' + nowTblType + '\', \''+item.data.openYear+'\', \''+item.location+'\', \'' + item.seq + '\')" class="krds-btn small link"><span class="underline">보기</span></a>'
                      +   '</td>'
    	}else{
    		tdData =  '<td class="download">'
          			+     '<button type="button" class="krds-btn xsmall open-tr" data-target="modal_down01">'
          			+       '<span class="sr-only">다운로드</span> <i class="svg-icon ico-down"></i>'
          			+     '</button>'
          			+   '</td>'
    	}
    	
    	
    	 var row = ''
          + '<tr data-nationCode="'+ code  +'" data-classCode="'+ (item.data.classCode || '') +'" data-openYear="'+ (item.data.openYear || '') +'" data-seq="'+ (item.seq || '') +'" >'
          +   '<td class="num">' + (start + i + 1) + '</td>'
          +   '<td class="inven">' + nowPage + '</td>'
          +   '<td class="nation">'
          +     nowNation
          +   '</td>'
          +   '<td class="class">'
          +     '<div class="class_box">'
          +       '<div class="txt_box">'
          +         '<em class="class_route">' + (item.location || '') + '</em>'
          +         (item.title || '')
          +       '</div>'
          +     '</div>'
          +   '</td>'
          +  tdData
          + '</tr>';
          
          $tbody.append(row);
    	
      }
     
    });
    
    
    
    //비교보기에 선택했던 항목들을 초기화 시킨다 -- 페이징 유지 선택으로 주석
    //selectRow = [];
    //$('ul.compar-list li:not(.infoLi)').remove();
    
    $('table.defaultTbl').find('input[type="checkbox"]').prop('checked', false);
    
    // 체크박스 초기화
    for(var i=0; i<selectRow.length; i++){
		var rowSeq = selectRow[i].seq;
		var chk = $('tr[data-seq="'+rowSeq+'"] .check').find('input[type="checkbox"]');
		if (chk.length > 0) {
		    chk.prop('checked', true);
		}
	}
	
	// 모두 선택된 경우 전체 선택 체크박스 체크
	var total = $('input[name="chk"]').length;
    var checked = $('input[name="chk"]:checked').length;
    $('input[name="chk_all"]').prop('checked', total === checked);
	
    $('.list_loading').hide();
  }

  function renderPagination() {
    const totalPages = getTotalPages();
	const half = Math.floor(state.maxPageLinks / 2);
	let start = Math.max(1, state.currentPage - half);
	let end = start + state.maxPageLinks - 1;

	if (end > totalPages) {
		end = totalPages;
		start = Math.max(1, end - state.maxPageLinks + 1);
	}

	const $links = $('#panel_edu_01 .page-links');
	$links.empty();

	// '처음' 버튼 표시 여부
	if (totalPages > state.maxPageLinks && state.currentPage > 1) {
		$('.page-navi.first').show();
	} else {
		$('.page-navi.first').hide();
	}

	// '이전' 버튼
	if (state.currentPage > 1) {
		$('.page-navi.prev').show();
	} else {
		$('.page-navi.prev').hide();
	}

	// 페이지 번호 앞 '...'
	if (start > 1) {
		$links.append('<a href="#" class="page-link">1</a>');
		$links.append('<span class="page-link link-dot">…</span>');
		
		$links.find('a.page-link').first().on('click', function (e) {
			e.preventDefault();
			state.currentPage = 1;
			renderAll();
			scrollToTableTop();
		});
	}

	// 페이지 번호들
	for (let i = start; i <= end; i++) {
		const $link = $('<a href="#" class="page-link">').text(i);
		if (i === state.currentPage) $link.addClass('active');
		$link.on('click', function (e) {
			e.preventDefault();
			state.currentPage = i;
			renderAll();
			scrollToTableTop();
		});
		$links.append($link);
	}

	// 페이지 번호 뒤 '...'
	if (end < totalPages) {
		$links.append('<span class="page-link link-dot">…</span>');
		$links.append('<a href="#" class="page-link">' + totalPages + '</a>');
		$links.find('a.page-link').last().on('click', function (e) {
			e.preventDefault();
			state.currentPage = totalPages;
			renderAll();
			scrollToTableTop();
		});
	}

	// '다음' 버튼
	if (state.currentPage < totalPages) {
		$('.page-navi.next').show();
	} else {
		$('.page-navi.next').hide();
	}

	// '끝' 버튼 표시 여부
	if (totalPages > state.maxPageLinks && state.currentPage < totalPages) {
		$('.page-navi.last').show();
	} else {
		$('.page-navi.last').hide();
	}
	
	$links.closest('.krds-pagination').show();
  }

  function renderAll() {
    renderList();
    renderPagination();
  }

  function bindEvents() {
    $('#panel_edu_01 .page-navi.first').off().on('click', function (e) {
      e.preventDefault();
      if (state.currentPage > 1) {
        state.currentPage = 1;
        renderAll();
        scrollToTableTop();
      }
    });

    $('#panel_edu_01 .page-navi.prev').off().on('click', function (e) {
      e.preventDefault();
      if (state.currentPage > 1) {
        state.currentPage--;
        renderAll();
        scrollToTableTop();
      }
    });

    $('#panel_edu_01 .page-navi.next').off().on('click', function (e) {
      e.preventDefault();
      if (state.currentPage < getTotalPages()) {
        state.currentPage++;
        renderAll();
        scrollToTableTop();
      }
    });

    $('#panel_edu_01 .page-navi.last').off().on('click', function (e) {
      e.preventDefault();
      const total = getTotalPages();
      if (state.currentPage < total) {
        state.currentPage = total;
        renderAll();
        scrollToTableTop();
      }
    });

    $('#select_td').off().on('change', function () {
      state.perPage = parseInt($(this).val(), 10);
      state.currentPage = 1;
      renderAll();
      scrollToTableTop();
    });
    
    //체크 유지 초기화
    $('.fancytree-checkbox').on('click', function (e) {
    	selectRow = [];  // 체크박스 초기화
    	$('ul.compar-list li:not(.infoLi)').remove();  // 비교보기 초기화
    });
  }
  
  function scrollToTableTop() {
	const $thead = $('#panel_edu_01 #'+ tableType +' table.defaultTbl thead'); // 또는 특정 id/class 부여
	if ($thead.length) {
		//$('html, body').animate({
		//	scrollTop: $thead.offset().top
		//}, 100); // 300ms 애니메이션
		
		$(window).scrollTop($thead.offset().top);
	}
  }
  
  


  bindEvents();
  renderAll();
}





//리스트 출력 End


function expandAndSelect(tree, step1, step2, step3, step4){
	var node = tree.getNodeByKey(step1);
	if(node){
		node.setExpanded(true).done(function(){
			selectNode(tree, step2, step3, step4);
		});
	}
}

function selectNode(tree, key, child, child2){
	var node = tree.getNodeByKey(key);
	
	if(node){
		if(child != ''){
			node.setExpanded(true).done(function(){
				selectNode(tree, child, child2, '');
			});
		} else {
			node.setSelected(true);
		}
	}
}


	// 1) 공용: 방금 붙은 영역만 다시 번역
	window.gtx = (function () {
	  var SRC = "ko";
	  function currentLang(){
	    var m = document.cookie.match(/(?:^|;\s*)googtrans=\/[^/]+\/([^;]+)/);
	    return m ? m[1] : SRC;
	  }
	  function apply(root){
	    var tgt = currentLang();
	    if (tgt === SRC) return; // 한국어면 스킵
	
	    var $root = (root && root.jquery) ? root : $(root || document.body);
	    // 번역이 막히지 않도록 notranslate 제거
	    $root.removeClass('notranslate').find('.notranslate').removeClass('notranslate');
	
	    // 렌더 끝난 다음 프레임에 번역 트리거
	    requestAnimationFrame(function(){
	      if (typeof window.doGTranslate === "function") {
	        try { window.doGTranslate(SRC + "|" + tgt); } catch(e){}
	      }
	    });
	  }
	  return { apply };
	})();

