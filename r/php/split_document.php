<?php
/* This section can be removed if you would like to reuse the PHP example outside of this PHP sample application */
require_once("lib/config.php");
require_once("lib/common.php");

$configManager = new Config();
if($configManager->getConfig('admin.password')==null){
	$url = 'setup.php';
	header("Location: $url");
	exit;
}

if ( isset($_GET["subfolder"]) && $_GET["subfolder"] != '') {
	$subfolder = $_GET['subfolder'];
} else {
	$subfolder = '';
}
?>
<!doctype html>
    <head>
        <title>Sprea Digital</title>
        <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
        <meta name="viewport" content="initial-scale=1,user-scalable=no,maximum-scale=1,width=device-width" />
        <style type="text/css" media="screen">
 

            html, body  { width:100%; height:100%; }
            body { margin:0; padding:0; overflow:auto; }

            /* LEFT CLICK TO SCROLL PAGES */
            .flowpaper_fisheye_panelLeft {
                background-color:inherit!important;
            }
            .flowpaper_fisheye_leftArrow {
                top: 20%!important;
                right: 10px!important;
                border-bottom: 16px solid transparent!important;
                border-top: 20px solid transparent!important;
            }
            /* RIGHT CLICK TO SCROLL PAGES */
            .flowpaper_fisheye_panelRight {
                background-color:inherit!important;
            }
            .flowpaper_fisheye_rightArrow {
                top: 20%!important;
                left: 10px!important;
                border-bottom: 16px solid transparent!important;
                border-top: 20px solid transparent!important;
            }

            #pagesContainer_documentViewer_panelRight, 
            #pagesContainer_documentViewer_panelLeft,
            #toolbar_documentViewer {
                background-color:black!important;
            }

            #toolbar_documentViewer_barSearchTools.flowpaper_tbseparator {
                display:none!important;
            }

            .flowpaper_tbbutton.flowpaper_bttnTextSelect {
                display:none!important;
            }
            .flowpaper_bttnPrint.flowpaper_tbbutton.print {
                display:none!important;
            }

            /*.flowpaper_bttnDownload.flowpaper_tbbutton.download {
                display:none!important;
            }
            */

            .flowpaper_fisheye_item { cursor:pointer!important; }
        </style>

		<link rel="stylesheet" type="text/css" href="css/flowpaper.css" />
		<script type="text/javascript" src="js/jquery.min.js"></script>
		<script type="text/javascript" src="js/jquery.extensions.min.js"></script>
        <!--[if gte IE 10 | !IE ]><!-->
        <script type="text/javascript" src="js/three.min.js"></script>
        <!--<![endif]-->
		<script type="text/javascript" src="js/flowpaper.js"></script>
		<script type="text/javascript" src="js/flowpaper_handlers.js"></script>
    </head>
    <body>
			<div id="documentViewer" class="flowpaper_viewer" style="position:absolute;left:0;top:0;width:100%;height:100%"></div>
			<div id="id_anagrafica"></div>
	        <?php
	        if(isset($_GET["doc"])){
	            $doc = substr($_GET["doc"],0,strlen($_GET["doc"])-4);
	        }else{
	            $doc = "Report";
	        }

			$pdfFilePath = $configManager->getConfig('path.pdf') . $subfolder;
			?>
	        	<script type="text/javascript">

					$(document).ready(function(){
					  	$('#id_anagrafica').html("<?php echo $_GET['a'];?>");
					})

		        	function getDocumentUrl(document){
			        	var numPages 			= <?php echo getTotalPages($pdfFilePath . $doc . ".pdf") ?>;
						var url = "{services/view.php?doc={doc}&format={format}&subfolder=<?php echo $subfolder; ?>&page=[*,0],{numPages}}";
							url = url.replace("{doc}",document);
							url = url.replace("{numPages}",numPages);
							return url;
		        	}

				var searchServiceUrl	= escape('services/containstext.php?doc=<?php echo $doc ?>&page=[page]&searchterm=[searchterm]');
				$('#documentViewer').FlowPaperViewer(
				  { config : {

						 DOC : escape(getDocumentUrl("<?php echo $doc ?>")),
						 Scale : 0.6,
						 ZoomTransition : 'easeOut',
						 ZoomTime : 0.5,
						 ZoomInterval : 0.2,
						 FitPageOnLoad : true,
						 FitWidthOnLoad : false,
						 FullScreenAsMaxWindow : false,
						 ProgressiveLoading : false,
						 MinZoomSize : 0.1,
						 MaxZoomSize : 7,
						 SearchMatchAll : false,
  						 SearchServiceUrl : searchServiceUrl,
						 InitViewMode : '',
						 EnableWebGL : true,
						 MixedMode : true,
						 RenderingOrder : '<?php echo ($configManager->getConfig('renderingorder.primary') . ',' . $configManager->getConfig('renderingorder.secondary')) ?>',

						 ViewModeToolsVisible : true,
						 ZoomToolsVisible : true,
						 NavToolsVisible : true,
						 CursorToolsVisible : true,
						 SearchToolsVisible : true,
  						 key : '<?php echo $configManager->getConfig('licensekey') ?>',

  						 DocSizeQueryService : 'services/swfsize.php?doc=<?php echo $doc ?>',

						 JSONDataType : 'jsonp',

						 WMode : 'transparent',
  						 localeChain: 'it_IT'
						 }}
				);
	        </script>
   </body>
</html>