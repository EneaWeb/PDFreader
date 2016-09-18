<%@ Page Language="C#" AutoEventWireup="true" CodeFile="simple_document.aspx.cs" Inherits="simple_document" %>
<%@ Import Namespace="lib" %>
<!doctype html>
<html>
    <head> 
        <title>FlowPaper</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="initial-scale=1,user-scalable=no,maximum-scale=1,width=device-width" />
        <style type="text/css" media="screen"> 
			html, body	{ height:100%; }
			body { margin:0; padding:0; overflow:auto; }   
			#flashContent { display:none; }
        </style> 
		
		<link rel="stylesheet" type="text/css" href="css/flowpaper.css" />
		<script type="text/javascript" src="js/jquery.min.js"></script>
		<script type="text/javascript" src="js/jquery.extensions.min.js"></script>
		<script type="text/javascript" src="js/flowpaper.js"></script>
		<script type="text/javascript" src="js/flowpaper_handlers.js"></script>
    </head> 
    <body>
			<div id="documentViewer" class="flowpaper_viewer" style="position:absolute;left:10px;top:10px;width:770px;height:500px"></div>
	        
	        <script type="text/javascript">   
		        function getDocQueryServiceUrl(document){
		        	return "services/swfsize.ashx?doc={doc}&page={page}".replace("{doc}",document);
		        }
		        
		        var startDocument = "<% if(Request["doc"]!=null){Response.Write(Request["doc"]);}else{%>Paper.pdf<% } %>";
	            jQuery.get((!window.isTouchScreen)?'UI_flowpaper_desktop.html':'UI_flowpaper_mobile.html',
                function(toolbarData) {
				$('#documentViewer').FlowPaperViewer(
				  { config : {
						 
						 PDFFile : "services/view.ashx?doc="+startDocument+"&format=pdf&page={page}",
						 Scale : 0.6, 
						 ZoomTransition : 'easeOut',
						 ZoomTime : 0.5, 
						 ZoomInterval : 0.1,
						 FitPageOnLoad : true,
						 FitWidthOnLoad : false, 
						 FullScreenAsMaxWindow : false,
						 ProgressiveLoading : false,
						 MinZoomSize : 0.2,
						 MaxZoomSize : 5,
						 SearchMatchAll : false,
						 RenderingOrder : '<%=(configManager.getConfig("renderingorder.primary") + ',' + configManager.getConfig("renderingorder.secondary")) %>',
						 
						 ViewModeToolsVisible : true,
						 ZoomToolsVisible : true,
						 NavToolsVisible : true,
						 CursorToolsVisible : true,
						 SearchToolsVisible : true,
  						 Toolbar         : toolbarData,

  						 DocSizeQueryService : 'services/swfsize.ashx?doc=' + startDocument,

						 JSONDataType : 'jsonp',
						 key : '<%=configManager.getConfig("licensekey") %>',
						   						  
  						 localeChain: 'en_US'
  						 
						 }}
				    );
			    });
	        </script>
   </body> 
</html> 