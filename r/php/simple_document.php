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
?>

<!doctype html>
    <head>
        <title>SPREA Reader</title>
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
        <!--[if gte IE 10 | !IE ]><!-->
        <script type="text/javascript" src="js/three.min.js"></script>
        <!--<![endif]-->
		<script type="text/javascript" src="js/flowpaper.js"></script>
		<script type="text/javascript" src="js/flowpaper_handlers.js"></script>
<script type="text/javascript"> 
$(function() {
      $('table tbody tr').mouseover(function() {
	  	 $(this).removeClass('checkedRow')
	  	 $(this).removeClass('unselectedRow');
         $(this).addClass('selectedRow');
      }).mouseout(function() {
	  	 if ($('input:first', this).attr('checked') == 'checked') {
		 	$(this).removeClass('selectedRow');
		 	$(this).addClass('checkedRow');
		 }
		 else {
		 	$(this).removeClass('selectedRow');
		 	$(this).addClass('unselectedRow');
			$(this).removeClass('checkedRow');
		 }
      }).click(function(event){
      	if(jQuery(event.target).hasClass('folder')){return;}
      	
      	 var tagName = (event && event.target)?event.target.tagName:window.event.srcElement.tagName;
		 if(tagName != 'INPUT' && !jQuery(event.target).hasClass('title')){
			<?php if(!$configManager->getConfig('splitmode') || $configManager->getConfig('splitmode') == "false"){ ?>
            var newWindow = window.open('simple_document.php?subfolder=<?php echo $subFolder ?>&doc='+ $('input:first', this).val(),'open_window','menubar, toolbar, location, directories, status, scrollbars, resizable, dependent, width=640, height=480, left=0, top=0');
            <?php }else{ ?>
            var newWindow = window.open('split_document.php?subfolder=<?php echo $subFolder ?>&doc='+ $('input:first', this).val(),'open_window','menubar, toolbar, location, directories, status, scrollbars, resizable, dependent, width=640, height=480, left=0, top=0');
            <?php } ?>
      	 }else{
			if(tagName != 'INPUT')
				$('input:first', this).prop("checked", !($('input:first', this).attr('checked') == 'checked'));
		}
      });
      
      
      $('.file-upload').fileUpload(
		{
			url: 'admin_files/controls/uploadify.php',
			type: 'POST',
			dataType: 'json',
			beforeSend: function () {
				jQuery('#Filename').val(jQuery('#Filedata').val().substr(jQuery('#Filedata').val().lastIndexOf("\\")+1));
			},
			complete: function () {
			},
			success: function (result, status, xhr) {
				if(result=='0'){
					alert('Unable to upload file. Please verify your server directory permissions.');
				}else{
					window.location.reload(true);
				}
			}
		}
	);
   });
</script> 
    </head>
    <body>
		<div id="documentViewer" class="flowpaper_viewer" style="position:absolute;left:10px;top:10px;width:770px;height:500px"></div>

	        <script type="text/javascript">
		        function getDocQueryServiceUrl(document){
		        	return "services/swfsize.php?doc={doc}&page={page}".replace("{doc}",document);
		        }

		        var startDocument = "<?php if(isset($_GET["doc"])){echo $_GET["doc"];}else{?>Paper.pdf<?php } ?>";

	            $('#documentViewer').FlowPaperViewer(
				 { config : {

						 PDFFile                    : "services/view.php?doc="+startDocument+"&format=pdf&page={page}&subfolder=<?php echo $_GET["subfolder"] ?>",
						 Scale                      : 0.6,
						 ZoomTransition             : 'easeOut',
						 ZoomTime                   : 0.5,
						 ZoomInterval               : 0.1,
						 FitPageOnLoad              : true,
						 FitWidthOnLoad             : false,
						 FullScreenAsMaxWindow      : false,
						 ProgressiveLoading         : false,
						 MinZoomSize                : 0.2,
						 MaxZoomSize                : 5,
						 SearchMatchAll             : false,
						 InitViewMode               : '',
						 EnableWebGL                : true,
						 RenderingOrder             : '<?php echo ($configManager->getConfig('renderingorder.primary') . ',' . $configManager->getConfig('renderingorder.secondary')) ?>',

						 ViewModeToolsVisible       : true,
						 ZoomToolsVisible           : true,
						 NavToolsVisible            : true,
						 CursorToolsVisible         : true,
						 SearchToolsVisible         : true,

  						 DocSizeQueryService        : 'services/swfsize.php?doc=' + startDocument,

						 JSONDataType               : 'jsonp',
						 key                        : '<?php echo $configManager->getConfig('licensekey') ?>',

                         WMode                      : 'transparent',
  						 localeChain                : 'it_IT'
						 }}
			    );
	        </script>
   </body>
</html>